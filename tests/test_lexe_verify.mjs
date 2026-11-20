import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { onRequestPost } from '../functions/api/contact-v2/verify.js';

const ID = 'a1111111-2222-4333-8444-555555555555';
const PREIMAGE = 'ab'.repeat(32);
const HASH = createHash('sha256').update(Buffer.from(PREIMAGE, 'hex')).digest('hex');
const URL = 'https://lexe.app/public/v1/lnurl_verify/test_Ab-1';
const INVOICE = 'lnbc210n1EXAMPLE_FROM_PREVIOUS_ISSUANCE';

function fakeDb(overrides = {}) {
  const row = {
    id: ID, state: 'invoiced', invoice: INVOICE, payment_hash: HASH,
    verify_url: URL, amount_msat: 21000,
    invoice_expires_at: Math.floor(Date.now() / 1000) + 900,
    paid_at: null, ...overrides
  };
  let updates = 0;
  return {
    row,
    get updates() { return updates; },
    prepare(sql) {
      if (/SELECT id, state, invoice, payment_hash/i.test(sql)) {
        return { bind(id) {
          assert.equal(id, ID);
          return { async first() { return row; } };
        } };
      }
      if (/UPDATE contact_v2_attempts SET state = 'paid'/i.test(sql)) {
        return { bind(paid_at, id, amount, inv, hash) {
          return { async run() {
            assert.equal(id, ID);
            assert.equal(amount, 21000);
            assert.equal(inv, INVOICE);
            assert.equal(hash, HASH);
            if (row.state !== 'invoiced') return { meta: { changes: 0 } };
            row.state = 'paid';
            row.paid_at = paid_at;
            updates++;
            return { meta: { changes: 1 } };
          } };
        } };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };
}
const env = db => ({ CONTACT_V2_VERIFY_ENABLED: 'true', CONTACT_DB: db });
const req = (body = { attempt_id: ID }, headers = {}) => new Request('https://preview.test/api/contact-v2/verify', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body)
});
const verified = { status: 'OK', settled: true, pr: INVOICE, preimage: PREIMAGE };
async function withFetch(mock, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try { return await fn(); } finally { globalThis.fetch = original; }
}

test('disabled verify endpoint performs no work', async () => {
  await withFetch(() => { throw Error('Unexpected fetch'); }, async () => {
    const response = await onRequestPost({ request: req(), env: {} });
    assert.equal(response.status, 404);
  });
});

test('unpaid invoice stays unpaid and causes no database update', async () => {
  const db = fakeDb();
  await withFetch(() => Response.json({ status:'OK', settled:false, pr:INVOICE }), async () => {
    const response = await onRequestPost({ request:req(), env:env(db) });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).state, 'invoiced');
    assert.equal(db.updates, 0);
  });
});

test('correct preimage and exact invoice mark only this attempt paid', async () => {
  const db = fakeDb();
  let called = 0;
  await withFetch(url => {
    assert.equal(String(url), URL); called++;
    return Response.json(verified);
  }, async () => {
    const response = await onRequestPost({ request:req(), env:env(db) });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.settled, true);
    assert.equal(body.state, 'paid');
    assert.equal(db.row.state, 'paid');
    assert.equal(db.updates, 1);
    assert.equal(called, 1);
    assert.ok(!JSON.stringify(body).includes(PREIMAGE));
    assert.ok(!JSON.stringify(body).includes(INVOICE));
  });
});

test('rechecking paid attempt is idempotent and never fetches Lexe', async () => {
  const db = fakeDb({state:'paid', paid_at: 123456});
  await withFetch(() => { throw Error('Should not fetch'); }, async () => {
    const response = await onRequestPost({ request:req(), env:env(db) });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).state, 'paid');
    assert.equal(db.updates, 0);
  });
});

test('wrong BOLT11 invoice is rejected', async () => {
  const db=fakeDb();
  await withFetch(() => Response.json({ ...verified, pr:'different-invoice' }), async () => {
    const response = await onRequestPost({ request:req(), env:env(db) });
    assert.equal(response.status, 502);
    assert.equal(db.updates, 0);
  });
});

test('incorrect or missing preimage is rejected', async () => {
  for (const preimage of ['cd'.repeat(32), undefined, 'bad']) {
    const db=fakeDb();
    await withFetch(() => Response.json({ ...verified, preimage }), async () => {
      const response = await onRequestPost({ request:req(), env:env(db) });
      assert.equal(response.status, 502);
      assert.equal(db.updates, 0);
    });
  }
});

test('rejects off-origin stored URL without making network request', async () => {
  const db=fakeDb({verify_url:'https://attacker.example/collect'});
  await withFetch(() => { throw Error('Must not make request'); }, async () => {
    const response = await onRequestPost({ request:req(), env:env(db) });
    assert.equal(response.status, 502);
    assert.equal(db.updates, 0);
  });
});

test('rejects redirects from Lexe', async () => {
  const db=fakeDb();
  await withFetch(() => new Response(null,{status:302,headers:{Location:'https://attacker.example/'}}), async () => {
    const response = await onRequestPost({ request:req(), env:env(db) });
    assert.equal(response.status, 502);
    assert.equal(db.updates, 0);
  });
});

test('invalid attempt ID does not touch D1 or Lexe', async () => {
  await withFetch(() => { throw Error('Should not fetch'); }, async () => {
    const response = await onRequestPost({ request:req({attempt_id:'../../test'}), env:{
      CONTACT_V2_VERIFY_ENABLED: 'true', CONTACT_DB:{prepare(){throw Error('Should not touch DB');}}
    }});
    assert.equal(response.status, 400);
  });
});

test('cross-origin request rejected', async () => {
  const response = await onRequestPost({ request:req({attempt_id:ID},{Origin:'https://evil.example'}), env:env(fakeDb()) });
  assert.equal(response.status, 403);
});

test('even a settled response marked ERROR does not mark paid', async () => {
  const db = fakeDb();
  await withFetch(() => Response.json({...verified,status:'ERROR'}), async () => {
    const response = await onRequestPost({request:req(),env:env(db)});
    assert.equal(response.status, 502);
    assert.equal(db.updates, 0);
  });
});

test('missing attempt returns 404 without contacting Lexe', async () => {
  await withFetch(() => {throw Error('No network expected');}, async () => {
    const response = await onRequestPost({ request:req(), env: {
      CONTACT_V2_VERIFY_ENABLED:'true',
      CONTACT_DB:{prepare(){return {bind(){return {async first(){return null;}};}};}}
    }});
    assert.equal(response.status, 404);
  });
});
