// Run on a developer machine with Node only if available; not required on Ubuntu.
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
if (!globalThis.crypto) globalThis.crypto = webcrypto;
import { onRequestPost } from '../functions/api/contact/verify.js';
const env = { CONTACT_DB: { prepare: () => ({ bind: () => ({ first: async () => null }) }) } };
async function call(body) {
  const request = new Request('https://example.invalid/api/contact/verify', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(body) });
  return onRequestPost({request, env});
}
let res = await call({});
assert.equal(res.status, 400);
assert.equal((await res.json()).error, 'Invalid attempt ID');
res = await call({attempt_id:'7b1513c2-39da-403f-b711-40b36d3545a5', receipt:{}});
assert.equal(res.status, 404);
console.log('verify endpoint smoke tests passed');
