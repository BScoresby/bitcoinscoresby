import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptRequest } from '../lib/contact-v2/accept-core.js';

const ID = 'a1111111-2222-4333-8444-555555555555';
const ID2 = 'b1111111-2222-4333-8444-555555555555';
const RECIPIENT = 'a'.repeat(64);
const EVENT_ID = 'b'.repeat(64);
const env = db => ({ CONTACT_V2_ACCEPT_ENABLED: 'true', CONTACT_DB: db, CONTACT_INBOX_PUBKEY: RECIPIENT });
const valid = async () => true; // Only acceptance state machine is mocked; production uses real NIP-17 crypto.
const EVENT = Object.freeze({
  kind: 1059, created_at: Math.floor(Date.now() / 1000),
  tags: [['p', RECIPIENT]], content: 'AgICAgICAg==', pubkey: 'c'.repeat(64),
  id: EVENT_ID, sig: 'd'.repeat(128)
});
const makeReq = (attempt_id = ID, event = EVENT, opts = {}) => new Request('https://preview.test/api/contact-v2/accept', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...opts.headers },
  body: opts.raw ?? JSON.stringify({ attempt_id, event }),
});

function fakeDb(state = 'paid', overrides = {}) {
  const attempts = new Map([[ID, {
    id: ID, state, paid_at: state === 'invoiced' ? null : 100,
    amount_msat: 21000, ...overrides
  }], [ID2, { id: ID2, state: 'paid', paid_at: 100, amount_msat: 21000 }]]);
  const messages = new Map();
  let inserts = 0;
  return {
    attempts, messages,
    get inserts() { return inserts; },
    prepare(sql) {
      if (/SELECT id, state, paid_at, amount_msat/i.test(sql)) {
        return { bind(id) { return { async first() { return attempts.get(id) ?? null; } }; } };
      }
      if (/SELECT seq, event_id, event_json/i.test(sql)) {
        return { bind(id) { return { async first() { return messages.get(id) ?? null; } }; } };
      }
      if (/SELECT event_id FROM contact_v2_messages WHERE event_id =/i.test(sql)) {
        return { bind(eventId) { return { async first() {
          return [...messages.values()].find(m => m.event_id === eventId) ?? null;
        } }; } };
      }
      if (/INSERT INTO contact_v2_messages/i.test(sql)) {
        assert.match(sql, /state = 'paid' AND paid_at IS NOT NULL AND amount_msat = 21000/);
        return { bind(event_id, event_json, accepted_at, id) {
          return { async run() {
            const attempt = attempts.get(id);
            if (!attempt || attempt.state !== 'paid' || attempt.paid_at === null || attempt.amount_msat !== 21000)
              return { meta: { changes: 0 } };
            if (messages.has(id) || [...messages.values()].some(m => m.event_id === event_id))
              throw Error('UNIQUE constraint failed');
            const seq = messages.size + 1;
            messages.set(id, { seq, event_id, event_json, accepted_at });
            attempt.state = 'accepted';
            inserts++;
            return { meta: { changes: 1 } };
          } };
        } };
      }
      throw Error(`unexpected query: ${sql}`);
    }
  };
}

const run = (db, request = makeReq(), verifier = valid, customEnv = env(db)) => acceptRequest({ request, env: customEnv }, verifier);

test('disabled endpoint does not touch database', async () => {
  const result = await run({prepare(){throw Error('should not execute');}}, makeReq(), valid, {});
  assert.equal(result.status, 404);
});
test('no D1 binding fails closed', async () => {
  const response = await run(null, makeReq(), valid, { CONTACT_V2_ACCEPT_ENABLED: 'true', CONTACT_INBOX_PUBKEY: RECIPIENT });
  assert.equal(response.status, 503);
});
test('unpaid attempt cannot store ciphertext and never runs crypto', async () => {
  const db = fakeDb('invoiced');
  const response = await run(db, makeReq(), () => { throw Error('crypto must not be called'); });
  assert.equal(response.status, 409);
  assert.equal(db.messages.size, 0);
  assert.equal(db.inserts, 0);
});
test('unknown attempt rejected', async () => {
  const db = fakeDb();
  const response = await run(db, makeReq('e1111111-2222-4333-8444-555555555555'));
  assert.equal(response.status, 404);
  assert.equal(db.messages.size, 0);
});
test('paid with no paid_at rejected', async () => {
  const db = fakeDb('paid', { paid_at: null });
  assert.equal((await run(db)).status, 409);
  assert.equal(db.messages.size, 0);
});
test('paid attempt can store one event and becomes accepted', async () => {
  const db = fakeDb();
  const response = await run(db);
  assert.equal(response.status, 201);
  assert.deepEqual((await response.json()).state, 'accepted');
  assert.equal(db.attempts.get(ID).state, 'accepted');
  assert.equal(db.messages.size, 1);
  assert.equal(db.inserts, 1);
});
test('identical retry returns same receipt without another insert', async () => {
  const db = fakeDb();
  await run(db);
  const response = await run(db, makeReq(), () => { throw Error('no repeat crypto required'); });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.already_accepted, true);
  assert.equal(data.seq, 1);
  assert.equal(db.inserts, 1);
});
test('same signed event with JSON properties in different order retries successfully', async () => {
  const db = fakeDb();
  await run(db);
  const reversed = Object.fromEntries(Object.entries(EVENT).reverse());
  const response = await run(db, makeReq(ID, reversed));
  assert.equal(response.status, 200);
  assert.equal(db.inserts, 1);
});
test('same payment with another event is rejected and cannot replace stored event', async () => {
  const db = fakeDb();
  await run(db);
  const different = { ...EVENT, id: 'e'.repeat(64), sig: 'f'.repeat(128) };
  const response = await run(db, makeReq(ID, different));
  assert.equal(response.status, 409);
  assert.equal(db.inserts, 1);
  assert.equal(db.messages.get(ID).event_id, EVENT_ID);
});
test('an event cannot be redeemed against a second paid attempt', async () => {
  const db = fakeDb();
  await run(db);
  const response = await run(db, makeReq(ID2));
  assert.equal(response.status, 409); // UNIQUE(event_id) prevents reuse on another payment.
  assert.equal(db.attempts.get(ID2).state, 'paid');
  assert.equal(db.inserts, 1);
});
test('simultaneous submissions consume at most one payment', async () => {
  const db = fakeDb();
  const different = { ...EVENT, id: 'e'.repeat(64) };
  const responses = await Promise.all([run(db), run(db, makeReq(ID, different))]);
  assert.equal(responses.filter(r => r.status === 201 || r.status === 200).length, 1);
  assert.equal(db.inserts, 1);
});
test('invalid signature means no insert', async () => {
  const db = fakeDb();
  const response = await run(db, makeReq(), async () => false);
  assert.equal(response.status, 400);
  assert.equal(db.inserts, 0);
});
test('wrong recipient rejected before signature verification', async () => {
  const db = fakeDb();
  const event = { ...EVENT, tags: [['p', 'f'.repeat(64)]] };
  assert.equal((await run(db, makeReq(ID, event))).status, 400);
  assert.equal(db.inserts, 0);
});
test('invalid format or extra unsigned property rejected', async () => {
  const db = fakeDb();
  assert.equal((await run(db, makeReq(ID, { ...EVENT, debug: 'unexpected' }))).status, 400);
  assert.equal((await run(db, makeReq(ID, { ...EVENT, kind: 4 }))).status, 400);
  assert.equal(db.inserts, 0);
});
test('invalid JSON and oversized requests rejected without D1 access', async () => {
  const db = fakeDb();
  assert.equal((await run(db, makeReq(ID, EVENT, { raw: '{broken' }))).status, 400);
  assert.equal((await run(db, makeReq(ID, EVENT, { raw: JSON.stringify({ attempt_id: ID, event: EVENT, padding: 'a'.repeat(20000) }) }))).status, 413);
  assert.equal(db.inserts, 0);
});
test('cross-origin post rejected', async () => {
  const db = fakeDb();
  const response = await run(db, makeReq(ID, EVENT, { headers: { Origin: 'https://evil.example' } }));
  assert.equal(response.status, 403);
});
test('missing inbox key fails closed', async () => {
  const db = fakeDb();
  const response = await run(db, makeReq(), valid, { CONTACT_V2_ACCEPT_ENABLED: 'true', CONTACT_DB: db });
  assert.equal(response.status, 503);
});
test('DB insert failure preserves paid state and can be retried', async () => {
  const db = fakeDb();
  const original = db.prepare.bind(db);
  let failOnce = true;
  db.prepare = sql => {
    if (/INSERT INTO contact_v2_messages/i.test(sql) && failOnce) {
      failOnce = false;
      return {bind(){return {async run(){throw Error('staging failure');}};}};
    }
    return original(sql);
  };
  assert.equal((await run(db)).status, 503);
  assert.equal(db.attempts.get(ID).state, 'paid');
  assert.equal((await run(db)).status, 201);
  assert.equal(db.inserts, 1);
});
