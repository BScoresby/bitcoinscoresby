#!/usr/bin/env python3
"""Check the protected Stage 4 preview endpoint from Ubuntu (no token printed).

Requirements: cloudflared installed; run `cloudflared access login <preview_url>`
first. The inbox token is read from ~/.config/bitcoinscoresby-inbox/read-token.
"""
import json
from pathlib import Path
import subprocess
import sys
import urllib.error
import urllib.request
from urllib.parse import urlparse

if len(sys.argv) != 2:
    raise SystemExit('Usage: python3 scripts/test_contact_v2_inbox_live.py https://YOUR-PREVIEW.pages.dev')
root = sys.argv[1].rstrip('/')
parsed = urlparse(root)
if parsed.scheme != 'https' or not parsed.hostname or not parsed.hostname.endswith('.pages.dev') or parsed.username or parsed.password or parsed.path not in ('', '/') or parsed.query or parsed.fragment:
    raise SystemExit('For safety, supply just the HTTPS hostname of your Cloudflare Pages preview (*.pages.dev).')
path = Path.home() / '.config' / 'bitcoinscoresby-inbox' / 'read-token'
if not path.is_file():
    raise SystemExit(f'No token file at {path}; run scripts/create_contact_v2_inbox_token.py first.')
if path.stat().st_mode & 0o077:
    raise SystemExit('Refusing token file that is readable by another user; chmod 600 first.')
token = path.read_text(encoding='ascii').strip()
if len(token) != 43:
    raise SystemExit('Unexpected local read-token length')
try:
    proc = subprocess.run(['cloudflared', 'access', 'token', '-app=' + root],
        capture_output=True, text=True, check=True, timeout=20)
except FileNotFoundError:
    raise SystemExit('cloudflared is not installed. See https://developers.cloudflare.com/cloudflare-one/tutorials/cli/')
except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
    raise SystemExit('Cloudflare Access login missing/expired. Run: cloudflared access login ' + root)
access_token = proc.stdout.strip()
if not access_token:
    raise SystemExit('Could not obtain a Cloudflare Access token; run cloudflared access login first.')

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None
opener = urllib.request.build_opener(NoRedirect)

def request(bearer=None, query='?after=0&limit=1'):
    headers = {
    'Accept': 'application/json',
    'cf-access-token': access_token,
    'User-Agent': 'BitcoinScoresby-Inbox-Test/1.0'
}
    if bearer is not None:
        headers['Authorization'] = 'Bearer ' + bearer
    req = urllib.request.Request(root + '/api/contact-v2/inbox' + query, headers=headers)
    try:
        with opener.open(req, timeout=20) as resp:
            status = resp.status
            body = resp.read(100000).decode('utf-8')
    except urllib.error.HTTPError as exc:
        status = exc.code
        body = exc.read(100000).decode('utf-8', errors='replace')
    try:
        return status, json.loads(body)
    except json.JSONDecodeError:
        raise SystemExit(f'HTTP {status}, non-JSON response. Cloudflare Access may require re-login or a different preview URL.')

status, _ = request()
assert status == 401, f'Unauthenticated request should be 401; got {status}'
print('PASS missing read token denied (401)')
status, _ = request('z' * 43)
assert status == 401, f'Incorrect read token should be 401; got {status}'
print('PASS incorrect read token denied (401)')
status, data = request(token)
assert status == 200 and data.get('ok') is True, f'Authorized GET failed with status {status}: {data}'
assert isinstance(data.get('messages'), list)
assert isinstance(data.get('next_after'), int)
assert isinstance(data.get('has_more'), bool)
assert all(m['seq'] <= data['next_after'] for m in data['messages'])
assert all(m['event']['kind'] == 1059 and m['event']['id'] == m['event_id'] for m in data['messages'])
assert all('attempt_id' not in m and 'invoice' not in m for m in data['messages'])
print(f"PASS authenticated encrypted inbox GET (returned {len(data['messages'])} record(s), next_after={data['next_after']}, has_more={data['has_more']})")
for m in data['messages']:
    print('  encrypted event:', m['seq'], m['event_id'])
status, d = request(token, '?after=' + str(data['next_after']) + '&limit=1')
assert status == 200 and d.get('ok') is True
assert all(m['seq'] > data['next_after'] for m in d['messages'])
print('PASS cursor-based follow-up does not repeat earlier records')
status, _ = request(token, '?limit=9999')
assert status == 400
print('PASS unbounded page size rejected (400)')
print('No plaintext, invoice, payment preimage or inbox credential was printed.')
