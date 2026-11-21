#!/usr/bin/env python3
"""Create one private random read token and print only its SHA-256 for Cloudflare.

The token itself is never displayed; do not commit it or copy it to Cloudflare.
If a token already exists, refuse to overwrite it. To rotate later, explicitly
revoke old server config and manage replacement outside this bootstrap script.
"""
import hashlib
import os
from pathlib import Path
import secrets
import sys

base = Path.home() / '.config' / 'bitcoinscoresby-inbox'
base.mkdir(mode=0o700, parents=True, exist_ok=True)
if base.is_symlink():
    sys.exit('Refusing symlinked credential directory')
os.chmod(base, 0o700)
path = base / 'read-token'
token = secrets.token_urlsafe(32)
flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
if hasattr(os, 'O_NOFOLLOW'):
    flags |= os.O_NOFOLLOW
try:
    fd = os.open(path, flags, 0o600)
except FileExistsError:
    sys.exit(f'Token already exists at {path}; refusing to overwrite it.')
with os.fdopen(fd, 'w', encoding='ascii') as f:
    f.write(token + '\n')

print(f'Private read token written to: {path}')
print('Add a NEW Cloudflare Preview encrypted secret:')
print('  Name:  CONTACT_V2_INBOX_TOKEN_SHA256')
print('  Value: ' + hashlib.sha256(token.encode('ascii')).hexdigest())
print('The token itself must remain on your computer. Do not commit it.')
