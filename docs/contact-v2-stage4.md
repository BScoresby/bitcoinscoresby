# Stage 4 — Authenticated read-only encrypted inbox

## Purpose

Add a private endpoint for the future separate Ubuntu inbox tool. Only previously accepted NIP-17 encrypted messages are returned. The server **does not** read `contact_v2_attempts`, expose invoices, decrypt messages, or accept writes.

No D1 migration is required; it reads the `contact_v2_messages` table already created in Stage 1. `_routes.json` already contains `/api/contact-v2/*` on your feature branch. The existing Contact v2 payment/accept endpoints remain unchanged.

## Install and test

From `~/bitcoinscoresby-contact-v2`:

```bash
unzip -n ~/Downloads/contact-v2-stage4-starter.zip
node --test tests/test_contact_v2_inbox.mjs
python3 tests/test_contact_v2_inbox_db.py
```

## Generate a read token on Ubuntu

```bash
python3 scripts/create_contact_v2_inbox_token.py
```

The script writes an unpredictable 32-byte random credential, URL-safe encoded, to `~/.config/bitcoinscoresby-inbox/read-token` (directory mode `0700`, file mode `0600`). It **does not print the credential itself**. It prints only the SHA-256 hash to install on Cloudflare. Store the token and its hash in different places; do not commit or paste the token into chat or developer tools.

The script refuses to overwrite an existing token. If you rerun it after a successful run, use the existing token, not a second token.

## Cloudflare Preview configuration

Under Workers & Pages → bitcoinscoresby → Settings → Variables and Secrets → **Preview**, add:

- Plain-text variable `CONTACT_V2_INBOX_ENABLED`: `true`
- **Encrypted secret** `CONTACT_V2_INBOX_TOKEN_SHA256`: the 64-character lowercase hexadecimal value printed by the token generator.

Keep `CONTACT_DB` bound to the existing separate `bitcoinscoresby-contact-staging` database. Leave `CONTACT_V2_INBOX_ENABLED` unset in Production. Do not change `CONTACT_INBOX_PUBKEY` or any Lexe variables. No SQL migration, wallet changes, or private Nostr key is needed.

## Deploy

```bash
cd ~/bitcoinscoresby-contact-v2
git branch --show-current
git status --short
git add functions/api/contact-v2/inbox.js lib/contact-v2/inbox-core.js \
  tests/test_contact_v2_inbox.mjs tests/test_contact_v2_inbox_db.py \
  scripts/create_contact_v2_inbox_token.py scripts/test_contact_v2_inbox_live.py \
  docs/contact-v2-stage4.md
git diff --cached --check
git diff --cached --stat
git commit -m "Add authenticated read-only Contact v2 inbox API"
git push origin feature/contact-lexe-v2
```

Wait for the Cloudflare preview deployment to show success, and verify the new Preview secret and flag are applied to the deployment.

## Verify against Cloudflare Access-protected Preview

**Do not paste the read token into your web browser's Console**. The terminal should be the only place that has read access to the local token.

`cloudflared` is needed to authenticate to an Access-protected preview from your terminal (see https://developers.cloudflare.com/cloudflare-one/tutorials/cli/). If installed, run:

```bash
cloudflared access login https://YOUR-EXACT-PREVIEW.pages.dev
python3 scripts/test_contact_v2_inbox_live.py https://YOUR-EXACT-PREVIEW.pages.dev
```

Use the exact preview hostname in BOTH commands. The live script authenticates with Cloudflare Access, then tests missing read token (401), incorrect read token (401), correct token (200), pagination, and invalid limit (400). It prints message event IDs, not ciphertext or plaintext. If the first GET returns a Cloudflare Access sign-in page rather than the JSON response, reauthenticate with `cloudflared access login` and confirm the hostname.

Your earlier staging event with sequence `1` should appear in the first authorized page if it remains in the database. Verify the returned `event_id` matches the Stage 3 accepted event. Any other accepted staging messages may also appear.

For a second independent check, run this against **staging** D1:

```bash
npx wrangler d1 execute bitcoinscoresby-contact-staging --remote \
  --command="SELECT seq, event_id FROM contact_v2_messages ORDER BY seq ASC LIMIT 5;"
```

No new message rows should be created by the inbox API.

## Response shape

`GET /api/contact-v2/inbox?after=0&limit=20` with `Authorization: Bearer <local-token>` responds with:

```json
{
  "ok": true,
  "messages": [{ "seq": 1, "event_id": "<64-hex-id>", "accepted_at": 1795200000, "event": {"kind": 1059, "id": "<64-hex-id>", "content": "<ciphertext>", "pubkey": "<hex>", "tags": [["p", "<hex>"]], "created_at": 1795200000, "sig": "<hex>"} }],
  "next_after": 1,
  "has_more": false
}
```

Max `limit` is 25. `after` means `seq` strictly greater than the cursor. Responses include one extra lookup row to set `has_more` without losing messages. The future sync utility must archive an entire page durably **before** committing `next_after`. A corrupted DB record fails the entire page rather than skipping it.

## Deployment boundaries and pending work

- Cloudflare Access is a secondary staging authentication layer. The bearer hash check in the Function is the intended long-term inbox credential. When we deploy publicly, use rate limiting and consider a token-rotation procedure.
- The API is logically read-only: it uses `SELECT` and has no delete, acknowledgment, or mutating operation.
- This stage does **not** deliver messages to your Ubuntu desktop, nor does it test decryption. That belongs in the separate inbox tool project.
- All accepted encrypted messages remain in D1. Add a backup/recovery plan before relying on this as the sole delivery location.
- A paid sender can still submit malicious ciphertext; the future local reader must be sandboxed and must validate and decrypt independently.
