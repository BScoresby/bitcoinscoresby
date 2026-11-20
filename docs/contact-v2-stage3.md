# Contact v2 – Stage 3: accept exactly one encrypted event per paid invoice

This patch assumes Stages 1, 2a and 2b have been committed to your **feature/contact-lexe-v2** branch, and that the isolated **Preview** D1 has the schema from `migrations/0001_contact_v2.sql`.

## New files

- `functions/api/contact-v2/accept.js`: the Pages Function wrapper
- `lib/contact-v2/accept-core.js`: bounded input, payment gate, NIP-17 validation and atomic insert
- `tests/test_contact_v2_accept.mjs`: 18 offline handler/state-machine tests (the cryptographic validator is mocked in these tests)
- `tests/test_contact_v2_accept_db.py`: four real SQLite constraint/trigger tests

Nothing overwrites or changes the old `/api/contact/` endpoints, the browser's NIP-17 implementation, or the database schema. Your `_routes.json` must already include `/api/contact-v2/*` from Stage 2a.

## Local checks

```bash
cd ~/bitcoinscoresby-contact-v2
node --test tests/test_contact_v2_accept.mjs
python3 tests/test_contact_v2_accept_db.py
node --check functions/api/contact-v2/accept.js
node --check lib/contact-v2/accept-core.js
```

The Node tests mock signature validation to test the payment/storage state machine. The real Pages Function imports `validateGiftWrap()` from the existing `functions/api/contact/send-validation.js`. A successful preview test using `giftWrap()` is required to verify actual signing compatibility.

## Cloudflare Preview configuration

In Workers & Pages > bitcoinscoresby > Settings > Variables and Secrets > **Preview**:

- `CONTACT_V2_ACCEPT_ENABLED` = `true` (plain text)
- `CONTACT_INBOX_PUBKEY` = your **dedicated recipient inbox's 64-hex-character public key** (plain text; not an nsec). Use the same pubkey as the existing contact page.
- `CONTACT_DB` must point at **staging** D1, never production.

Leave `CONTACT_V2_ACCEPT_ENABLED` unset in **Production**. Changing variables requires a fresh Preview deployment.

## Browser test: use an already paid 21-sat invoice

Use the **Access-authenticated Preview** origin. Navigate to its `/contact/` page and open Developer Tools > Console. The following imports your website's existing, self-hosted NIP-17 encryption module; no third-party script runs.

Set `attemptId` to the attempt that Stage 2b verified as paid, and `recipient` to the 64-hex public key in your Preview `CONTACT_INBOX_PUBKEY` variable:

```javascript
const attemptId = 'PASTE_A_PAID_ATTEMPT_UUID_HERE';
const recipient = 'PASTE_CONTACT_INBOX_PUBKEY_64_HEX_HERE';
const { giftWrap } = await import('/contact/nostr-crypto.js');
const event = await giftWrap('Contact v2 staging acceptance test – November 2026', recipient);

const accept = async ev => {
  const response = await fetch('/api/contact-v2/accept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ attempt_id: attemptId, event: ev })
  });
  return { status: response.status, data: await response.json() };
};

console.log(await accept(event)); // expected 201 accepted
console.log(await accept(event)); // expected 200 already_accepted
console.log(await accept(await giftWrap('This is a different event', recipient))); // expected 409
```

IMPORTANT: For retries, reuse exactly the same `event` object. `giftWrap()` generates new keys and a new event ID on every invocation. Do not send your inbox private key, invoice preimage or API credential to the browser or this script.

To test rejection of unpaid attempts separately, generate a new invoice but **do not pay it**, and submit a gift wrap using that new `attempt_id`. Expect `409 Payment not verified` and no message row.

## Check D1 (read-only)

```bash
npx wrangler d1 execute bitcoinscoresby-contact-staging --remote \
  --command="SELECT id, state, paid_at FROM contact_v2_attempts ORDER BY created_at DESC LIMIT 5;"

npx wrangler d1 execute bitcoinscoresby-contact-staging --remote \
  --command="SELECT seq, attempt_id, event_id, accepted_at FROM contact_v2_messages ORDER BY seq DESC LIMIT 5;"
```

Expect exactly one new row, and the corresponding attempt state `accepted`. Do not print or post `event_json` in logs/chat; it is ciphertext but may still expose metadata.

## Security limitations still outstanding

- This step verifies the outer Nostr signature, recipient and NIP-44 payload format. **Cloudflare cannot decrypt or certify the inner message.** Local decryption must be tested before launch.
- The attempt ID is a hard-to-guess bearer capability. Treat it as private for the life of the payment. Future recovery design should explicitly handle stolen/leaked attempt IDs.
- Rate limiting, attempt cleanup, an authenticated inbox API and local sync are **not** implemented yet. Keep this behind Cloudflare Access and disabled in Production.
- Backend code enforces immutable accepted events; privileged D1 writers can still run SQL UPDATE/DELETE until separately constrained.
- No public website UI changes are included in Stage 3.
