# Stage 5 — Contact v2 preview page

This patch **does not overwrite `/contact/`** and does not change any Cloudflare API endpoints, D1 tables, bindings, or secrets. It adds static files under `contact-v2/` and a Node test.

## Files

- `contact-v2/index.html` — isolated preview page retaining existing site's terminal visual style
- `contact-v2/contact-v2.js` — browser controller: encrypt, issue 21-sat invoice, poll Lexe, accept ciphertext
- `contact-v2/contact-v2.css` — layout overrides for the preview form
- `contact-v2/flow.mjs` — pure session and input validators
- `tests/test_contact_v2_browser.mjs` — 12 pure-helper tests

## Install

From the `feature/contact-lexe-v2` worktree:

```bash
cd ~/bitcoinscoresby-contact-v2
unzip -n ~/Downloads/contact-v2-stage5-starter.zip
node --test tests/test_contact_v2_browser.mjs
node --check contact-v2/contact-v2.js
```

Review `contact-v2/flow.mjs`: `RECIPIENT_HEX` is the known contact inbox public key `0aa03f87ef253bc362ee071c3934ba9165c423bd39dafc0b302ce472eb6719a8`. **Confirm it matches the Preview secret `CONTACT_INBOX_PUBKEY`**, without revealing any secret values. It is intentionally a *public* key.

Commit and push:

```bash
git add contact-v2/index.html contact-v2/contact-v2.js contact-v2/contact-v2.css contact-v2/flow.mjs tests/test_contact_v2_browser.mjs
git diff --cached --check
git diff --cached --stat
git commit -m "Add isolated Lexe Contact v2 browser flow"
git push origin feature/contact-lexe-v2
```

In Cloudflare, open latest Preview deployment then add `/contact-v2/` to its hostname. **Do not test this on production** (production has disabled v2 feature flags).

## One end-to-end test (costs 21 sats)

1. Verify the new preview page loads without console errors. Confirm your `/contact/` page has not changed.
2. Write a short test message. Optionally provide a reply address. Click `Request postage · 21 sats`.
3. Observe the QR and invoice, with a status saying that payment is awaited. **At this point D1 must have a new `invoiced` attempt but no new message.**
4. Refresh the **same preview hostname** *before paying*. The invoice and encrypted draft should be restored; do not generate a second invoice.
5. Pay the displayed BOLT11 invoice using your other wallet. The page should check settlement automatically when visible, then submit **the exact same encrypted NIP-17 event** to `/api/contact-v2/accept`.
6. Look for `Message securely accepted`, with the event ID and D1 sequence number.
7. Query the staging D1 database to see one new accepted message:

```bash
npx wrangler d1 execute bitcoinscoresby-contact-staging --remote \
  --command="SELECT seq,attempt_id,event_id,accepted_at FROM contact_v2_messages ORDER BY seq DESC LIMIT 5;"
```

8. Refresh after success: no invoice should appear again. You may write another message, but **do not make a second payment** during this test.

## Design and recovery details

- The browser encrypts with the existing `/contact/nostr-crypto.js` NIP-17 implementation before requesting an invoice. Cloudflare receives no ciphertext before settlement. No Nostr signup or message relays are needed.
- The encrypted gift wrap and invoice metadata (including payment-attempt UUID) are saved **in browser localStorage**, with no plaintext draft. The return address is included *inside the encrypted message*.
- The page checks the existing `verify` endpoint every 6 seconds while visible. No settlement claims are accepted from the browser or a wallet callback: only the server's Lexe verification result matters.
- After `paid`/`accepted`, the page submits the **same** saved ciphertext. Server handles 201 or idempotent 200. The page removes local recovery only after the server confirms the matching accepted event ID.
- On connection/server errors, a paid attempt keeps its original saved ciphertext and retries. Payment never needs repeating.
- If Lexe reports an expired unpaid invoice, the page stops polling and allows an explicitly confirmed discard. Do not discard an invoice that may have been paid. It is possible to check manually again.
- **Preview-hostname caveat:** localStorage is scoped to a browser origin. Reloading the same `https://HASH.bitcoinscoresby.pages.dev` works; visiting a *different* deployment hash cannot access the old localStorage record. Use one consistent preview hostname throughout a paid test.
- **Recovery deadline:** The existing server `send-validation.js` currently accepts events only with an outer timestamp within four days. Gift wraps deliberately backdate timestamps up to two days, so a pending event can become too old after about two days. Recovery is for normal interruptions/reloads, not indefinite storage. Do not tell users indefinite recovery is supported until server policy is reviewed.
- If the user's browser clears localStorage, switches browser/device, or changes preview origin, it won't automatically recover the payment attempt. A broader recovery design can add explicit encrypted-export support later.
- This stage is **still not production-ready**. We need rate limits, expiry/cleanup policies, NIP-17 decryption with the recipient nsec, and an explicit production cutover. Keep Preview behind Cloudflare Access.

## Security properties

- Stage 5 adds **no public inbox access**, API credentials, server-side plaintext, or third-party widget scripts.
- The receiving hex public key is intentionally public; your recipient private key never enters Cloudflare.
- localStorage ciphertext/UUID is exposed to any future script executing on the same website origin; continue to serve only trusted self-hosted scripts and keep CSP restrictive.
- The existing D1 paid-state and UNIQUE constraints remain the actual enforcement boundary. Browser checks are only for UX.
- The JavaScript crypto implementation is still self-contained and unaudited; independent decryption tests are required before shipping.
