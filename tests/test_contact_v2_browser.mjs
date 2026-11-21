import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RECIPIENT_HEX, STORAGE_KEY, composeMessage, validEvent,
  validateInvoiceResponse, createSession, validSession, loadSession, saveSession
} from '../contact-v2/flow.mjs';

const id = '430edf9f-7e11-4174-8745-2851bb8a2261';
const event = () => ({
  kind: 1059, id: 'a'.repeat(64), pubkey: 'b'.repeat(64), sig: 'c'.repeat(128),
  created_at: 1795200000, tags: [['p', RECIPIENT_HEX]], content: 'Ag' + 'A'.repeat(300)
});
const invoice = () => ({
  ok: true, attempt_id: id, invoice: 'lnbc210n1' + 'a'.repeat(250),
  amount_msat: 21000, invoice_expires_at: 1800000000
});
const fakeStore = () => {
  const map = new Map();
  return {getItem: k => map.get(k) ?? null, setItem: (k,v) => {map.set(k,v);}, removeItem: k => {map.delete(k);} };
};

test('recipient is a 64-char hex pubkey, matching the previous inbox', () => {
  assert.match(RECIPIENT_HEX, /^[0-9a-f]{64}$/);
});
test('empty or whitespace-only message rejected', () => {
  assert.throws(() => composeMessage('  '));
});
test('message length boundary enforced', () => {
  assert.equal(composeMessage('x'.repeat(2000)).length, 2000);
  assert.throws(() => composeMessage('x'.repeat(2001)));
});
test('reply address is included inside the encrypted plaintext, not in a separate record', () => {
  assert.equal(composeMessage('Hi', 'npub1test'), 'Hi\n\nReply address: npub1test');
  assert.throws(() => composeMessage('Hi', 'x'.repeat(201)));
});
test('invoice must specify exactly 21000 millisatoshis', () => {
  assert.equal(validateInvoiceResponse(invoice()).amount_msat, 21000);
  assert.throws(() => validateInvoiceResponse({...invoice(),amount_msat:20000}));
});
test('invoice requires valid attempt ID and mainnet BOLT11 shape', () => {
  assert.throws(() => validateInvoiceResponse({...invoice(),attempt_id:'bad'}));
  assert.throws(() => validateInvoiceResponse({...invoice(),invoice:'lntb100n1'+'a'.repeat(250)}));
});
test('event is a NIP-17 outer gift wrap to expected recipient', () => {
  assert.ok(validEvent(event()));
  assert.equal(validEvent({...event(),kind:14}), false);
  assert.equal(validEvent({...event(),tags:[['p','f'.repeat(64)]]}), false);
});
test('session saves ciphertext + invoice but never plaintext', () => {
  const store = fakeStore();
  const record = createSession(invoice(), event());
  saveSession(store,record);
  const stored = store.getItem(STORAGE_KEY);
  assert.ok(stored.includes('lnbc210n'));
  assert.ok(stored.includes(event().id));
  assert.equal(stored.includes('my secret message'),false);
  assert.deepEqual(loadSession(store),record);
});
test('paid phase can be retained without replacing the encrypted event', () => {
  const store = fakeStore();
  const record = createSession(invoice(),event());
  record.phase = 'paid';
  saveSession(store,record);
  assert.equal(loadSession(store).phase,'paid');
  assert.equal(loadSession(store).event.id, event().id);
});
test('corrupt stored attempt fails closed instead of returning null', () => {
  const store = fakeStore();
  store.setItem(STORAGE_KEY, '{truncated');
  assert.throws(() => loadSession(store),/corrupt/);
});
test('malicious event substitution or payment edits fail validation', () => {
  const record = createSession(invoice(), event());
  assert.equal(validSession({...record, event: {...record.event,tags:[['p','f'.repeat(64)]]}}),false);
  assert.equal(validSession({...record, attempt_id:'not-a-uuid'}),false);
  assert.equal(validSession({...record,phase:'accepted'}),false);
});
test('disabled browser storage causes a failure', () => {
  const store = {getItem:()=>null,setItem:()=>{throw Error('QuotaExceeded');}};
  assert.throws(()=>saveSession(store,createSession(invoice(),event())), /QuotaExceeded/);
});
