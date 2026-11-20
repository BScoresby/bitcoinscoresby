# BitcoinScoresby Contact v2 — Stage 2a: create Lexe invoices

An **additive** Cloudflare Pages Function. Does NOT change your existing contact
page, does NOT verify settlement, and NEVER writes message ciphertext.

## Install

Copy `functions/api/contact-v2/invoice.js`, `lib/contact-v2/bolt11.js`, and
`tests/test_lexe_invoice.mjs` into the identical paths in your
`feature/contact-lexe-v2` worktree. The parser is outside `functions/` so
Cloudflare does not interpret it as an additional HTTP route.

Your main repository's `_routes.json` must have `/api/contact-v2/*` in `include`
(otherwise the new Pages Function isn't invoked). Do NOT replace its other rules.

Set these **Preview** environment variables under Pages > Settings > Variables
and Secrets:

- `LEXE_USERNAME` = your Lexe Lightning Address username, without `@lexe.app`.
- `CONTACT_V2_INVOICE_ENABLED` = `true` to enable this endpoint for preview testing.

Leave Production variables unset. Preview must be bound to its isolated staging
`CONTACT_DB` D1. Redeploy after changing bindings/variables.

## Test locally

`node --test tests/test_lexe_invoice.mjs`

Then commit and push to feature branch. Use Cloudflare Access protected preview
and, with Developer Tools Console on that preview URL, invoke:

```js
const r = await fetch('/api/contact-v2/invoice', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
});
const out = await r.json();
console.log(r.status, out.ok, out.amount_msat, out.attempt_id,
            out.invoice?.slice(0, 22), out.error);
```

This creates an unpaid invoice and a temporary D1 attempt; **do not pay it yet**.
Look for one `state='invoiced'` row with no message rows. The backend returns
only the invoice and attempt ID, never the Lexe verification URL.

## Limitations / launch blockers

- This is only **invoice issuance**, not settlement verification or message acceptance.
- Configure Cloudflare rate limiting for `/api/contact-v2/invoice` BEFORE exposing
  it publicly. Same-origin checks aren't an anti-DoS control.
- Parser validates invoice structure, Bech32 checksum, payment hash, amount and
  expiry. It does NOT independently verify BOLT11 ECDSA signature; the invoice
  is received from Lexe over HTTPS and bound to the Lexe verify endpoint.
- Tests use generated structural invoices and a mocked Lexe API. No actual Lexe
  payment or live invoice was tested by this package.
- Avoid changing production or merging this branch before all v2 security tests.
