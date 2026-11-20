# Contact v2 / Stage 2b — Lexe LNURL-Verify

Adds `POST /api/contact-v2/verify` alongside the Stage 2a invoice endpoint.

## Purpose and boundaries

- A caller supplies *only* an `attempt_id` UUID. Invoice, payment hash and Lexe verify URL are read from the Preview D1 database.
- A paid state requires `status: OK`, `settled: true`, an exact invoice (`pr`) match, and a 32-byte preimage whose SHA-256 equals the payment hash stored in D1.
- D1 UPDATE is conditional on an existing `invoiced` attempt. Repeating verification for a `paid` / `accepted` record is idempotent.
- No ciphertext or message metadata is accepted by this endpoint. The existing contact page is unchanged.
- Never return the preimage or verification URL in the response.

## Install

From `~/bitcoinscoresby-contact-v2`, extract this zip to the worktree root:

```sh
unzip -n ~/Downloads/contact-v2-phase2b-starter.zip
node --test tests/test_lexe_verify.mjs
```

Before public use, keep Preview protected by Cloudflare Access, and configure abuse protection. The endpoint is not yet production ready.

Under **Cloudflare Pages → bitcoinscoresby → Settings → Variables and Secrets → Preview** add **plain-text** variable:

```
CONTACT_V2_VERIFY_ENABLED = true
```

This is a non-secret feature switch; keep it absent in Production. The existing Preview D1 `CONTACT_DB` binding is required.

After a push/redeploy, visit the Access-protected Preview, open the Console:

### Verify an unpaid invoice first

Create a fresh invoice with the already-deployed endpoint:

```js
const ir = await fetch('/api/contact-v2/invoice', {
  method: 'POST', headers: {'Content-Type':'application/json'}, body: '{}'
});
const invoiceData = await ir.json();
console.log(ir.status, invoiceData.ok, invoiceData.attempt_id);
```

Check settlement while invoice is unpaid:

```js
const vr = await fetch('/api/contact-v2/verify', {
  method: 'POST', headers: {'Content-Type':'application/json'},
  body: JSON.stringify({attempt_id: invoiceData.attempt_id})
});
console.log(vr.status, await vr.json());
```

Expected: `200 {ok:true, settled:false, state:'invoiced', expired:false}` for a fresh unpaid invoice.

### Real 21-sat payment

From the response to `/invoice`, pay `invoiceData.invoice` using your external Lightning wallet. Do not paste the private key, preimage, or full invoice into a public chat. Then repeat the verification request; expect `settled:true` and `state:'paid'`. It may take a short period for Lexe to report settlement. Retry the **same** attempt; do not request another invoice for each poll.

Read staging D1:

```sh
npx wrangler d1 execute bitcoinscoresby-contact-staging --remote \
  --command="SELECT id, state, amount_msat, paid_at FROM contact_v2_attempts ORDER BY created_at DESC LIMIT 5;"

npx wrangler d1 execute bitcoinscoresby-contact-staging --remote \
  --command="SELECT COUNT(*) AS messages FROM contact_v2_messages;"
```

After paying and verifying, newest attempt should be `paid`, amount `21000`, `paid_at` non-null. Message count stays zero. Calling `/verify` again should produce `state:'paid'` and not create anything new.

## Safety and limits

- Authentication is not required for this staging endpoint because a random attempt UUID acts as an unguessable lookup token. This is **not** a rate-limiting or general authentication solution.
- Only the server-stored `lexe.app` URL may be fetched, with redirects disabled and response size bounded.
- LNURL-Verify depends on Lexe's truthful reporting of `settled`; the returned preimage corroborates the invoice hash, but is not independent proof against a dishonest issuer.
- An invoice may be verified after it expires if Lexe reports that it already settled; an expired, unpaid invoice remains unpaid.
- Run behind Access while developing; deploy Cloudflare WAF/rate limits before public launch.
- Stage 2b does not create the encrypted-message acceptance endpoint, and does not alter the live contact flow.
