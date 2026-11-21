import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { inboxRequest } from '../lib/contact-v2/inbox-core.js';

const TOKEN = 't'.repeat(43);
const HASH = createHash('sha256').update(TOKEN).digest('hex');
const makeEvent = id => ({
  kind: 1059, created_at: 1795200000, tags: [['p', 'a'.repeat(64)]],
  content: 'A'.repeat(120), pubkey: 'b'.repeat(64), id,
  sig: 'c'.repeat(128),
});
const row = (seq, changes = {}) => {
  const id = seq.toString(16).padStart(64, '0');
  return { seq, event_id: id, event_json: JSON.stringify(makeEvent(id)), accepted_at: 1795200000 + seq, ...changes };
};
function fakeDB(rows = [row(1)], opts = {}) {
  const calls = [];
  const db = {
    calls,
    prepare(sql) {
      calls.push(sql);
      assert.match(sql, /FROM contact_v2_messages/);
      assert.match(sql, /WHERE seq > \?/);
      assert.match(sql, /ORDER BY seq ASC/);
      assert.doesNotMatch(sql, /contact_v2_attempts|\bUPDATE\b|\bDELETE\b|\bINSERT\b/i);
      return {
        bind(after, count) {
          return {
            async all() {
              if (opts.throw) throw Error('sensitive raw DB error');
              if (opts.invalidResult) return { success: false, results: [] };
              return { success: true, results: rows.filter(r => r.seq > after).slice(0, count) };
            },
          };
        },
      };
    },
  };
  return db;
}
const env = db => ({ CONTACT_V2_INBOX_ENABLED: 'true', CONTACT_V2_INBOX_TOKEN_SHA256: HASH, CONTACT_DB: db });
const makeRequest = (path = '/api/contact-v2/inbox', bearer = TOKEN, method = 'GET') =>
  new Request('https://preview.example' + path, {
    method,
    headers: bearer === null ? {} : { Authorization: `Bearer ${bearer}` },
  });
const run = (db, request = makeRequest(), contextEnv = env(db)) => inboxRequest({ request, env: contextEnv });

test('endpoint disabled in production unless flag enabled', async () => {
  const r = await run(fakeDB(), makeRequest(), {});
  assert.equal(r.status, 404);
});
test('non-GET method rejected', async () => {
  const r = await run(fakeDB(), makeRequest('/api/contact-v2/inbox', TOKEN, 'POST'));
  assert.equal(r.status, 405);
  assert.equal(r.headers.get('allow'), 'GET');
});
test('no credential returns 401 and never touches D1', async () => {
  const db = fakeDB(); const r = await run(db, makeRequest('/api/contact-v2/inbox', null));
  assert.equal(r.status, 401); assert.equal(db.calls.length, 0);
  assert.match(r.headers.get('www-authenticate'), /Bearer/);
});
test('incorrect credential returns 401 and never touches D1', async () => {
  const db = fakeDB(); const r = await run(db, makeRequest('/api/contact-v2/inbox', 'z'.repeat(43)));
  assert.equal(r.status, 401); assert.equal(db.calls.length, 0);
});
test('wrong-length or malformed credential rejected', async () => {
  const db = fakeDB();
  assert.equal((await run(db, makeRequest('/api/contact-v2/inbox', 'too-short'))).status, 401);
  assert.equal(db.calls.length, 0);
});
test('missing configured encrypted secret fails closed', async () => {
  const db = fakeDB(); const e = env(db); delete e.CONTACT_V2_INBOX_TOKEN_SHA256;
  assert.equal((await run(db, makeRequest(), e)).status, 503);
  assert.equal(db.calls.length, 0);
});
test('missing database fails closed', async () => {
  const e = env(null); delete e.CONTACT_DB;
  assert.equal((await run(null, makeRequest(), e)).status, 503);
});
test('authorized request returns encrypted event only, no payment metadata', async () => {
  const db = fakeDB(); const r = await run(db);
  assert.equal(r.status, 200);
  const payload = await r.json();
  assert.deepEqual(Object.keys(payload).sort(), ['has_more','messages','next_after','ok']);
  assert.equal(payload.messages.length, 1);
  assert.equal(payload.messages[0].event.kind, 1059);
  assert.equal(payload.messages[0].seq, 1);
  assert.equal(payload.messages[0].event_id, row(1).event_id);
  assert.equal(payload.next_after, 1);
  assert.equal(payload.has_more, false);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.equal(r.headers.get('access-control-allow-origin'), null);
  assert.ok(!JSON.stringify(payload).includes('attempt_id'));
  assert.ok(!JSON.stringify(payload).includes('invoice'));
  assert.ok(!JSON.stringify(payload).includes(TOKEN));
});
test('stable cursor pagination with lookahead row and no skips', async () => {
  const db = fakeDB([row(1), row(3), row(8), row(10)]);
  const a = await (await run(db, makeRequest('/api/contact-v2/inbox?after=0&limit=2'))).json();
  assert.deepEqual(a.messages.map(m => m.seq), [1,3]);
  assert.equal(a.has_more, true); assert.equal(a.next_after, 3);
  const b = await (await run(db, makeRequest(`/api/contact-v2/inbox?after=${a.next_after}&limit=2`))).json();
  assert.deepEqual(b.messages.map(m => m.seq), [8,10]);
  assert.equal(b.has_more, false); assert.equal(b.next_after, 10);
});
test('empty inbox page retains cursor', async () => {
  const p = await (await run(fakeDB(), makeRequest('/api/contact-v2/inbox?after=100'))).json();
  assert.deepEqual(p.messages, []); assert.equal(p.next_after, 100); assert.equal(p.has_more, false);
});
test('pagination input is strictly bounded', async () => {
  const db = fakeDB();
  for (const path of [
    '?after=-1', '?after=oops', '?after=9007199254740992',
    '?limit=0', '?limit=26', '?limit=1.2', '?limit=9999999',
    '?after=1&after=2', '?limit=1&limit=2', '?ignored=foo',
  ]) {
    const r = await run(db, makeRequest('/api/contact-v2/inbox'+path));
    assert.equal(r.status, 400, path);
  }
  assert.equal(db.calls.length, 0);
});
test('database failure fails closed without leaking error contents', async () => {
  const r = await run(fakeDB([], {throw:true}));
  assert.equal(r.status, 503);
  assert.ok(!(await r.text()).includes('sensitive raw DB error'));
});
test('corrupted row fails entire page; does not skip the cursor', async () => {
  const db = fakeDB([row(1), row(2, {event_json: 'not json'})]);
  const r = await run(db);
  assert.equal(r.status, 503);
  assert.ok(!(await r.text()).includes('next_after'));
});
test('mismatched event ID fails closed', async () => {
  const db = fakeDB([row(1, {event_id: 'f'.repeat(64)})]);
  assert.equal((await run(db)).status, 503);
});
test('malformed D1 response fails closed', async () => {
  assert.equal((await run(fakeDB([], {invalidResult:true}))).status, 503);
});
