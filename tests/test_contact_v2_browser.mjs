import test from 'node:test';
import assert from 'node:assert/strict';
import {encryptEnvelope,hashEnvelope,toBase64Url} from '../contact-v2/envelope.mjs';
import {STORAGE_KEY,composeMessage,validateInvoiceResponse,createSession,validSession,loadSession,saveSession} from '../contact-v2/flow.mjs';
const ID = '430edf9f-7e11-4174-8745-2851bb8a2261';
const store = () => { const m=new Map(); return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}; };
async function fixture() {
  const pair=await crypto.subtle.generateKey('X25519',true,['deriveBits']);
  const key=toBase64Url(await crypto.subtle.exportKey('raw',pair.publicKey));
  const envelope=await encryptEnvelope('secret text',key), hash=await hashEnvelope(envelope);
  const invoice={ok:true,amount_msat:21000,attempt_id:ID,invoice:'lnbc210n1'+'a'.repeat(250),invoice_expires_at:1800000000,envelope_hash:hash};
  return {envelope,hash,invoice};
}
test('optional reply stays inside plaintext; empty messages rejected',()=>{
  assert.equal(composeMessage('Hi', 'npub1test'),'Hi\n\nReply address: npub1test');
  assert.throws(()=>composeMessage('  '));
  assert.throws(()=>composeMessage('x'.repeat(2001)));
  assert.throws(()=>composeMessage('Hi','x'.repeat(201)));
});
test('invoice must bind exact commitment and 21 sats',async()=>{
  const {hash,invoice}=await fixture();
  assert.equal(validateInvoiceResponse(invoice,hash).envelope_hash,hash);
  assert.throws(()=>validateInvoiceResponse({...invoice,envelope_hash:'0'.repeat(64)},hash));
  assert.throws(()=>validateInvoiceResponse({...invoice,amount_msat:22000},hash));
});
test('localStorage saves only ciphertext, payment and hash for recovery',async()=>{
  const {envelope,hash,invoice}=await fixture(), s=store();
  const record=createSession(invoice,envelope,hash);saveSession(s,record);
  assert.deepEqual(loadSession(s),record);
  const raw=s.getItem(STORAGE_KEY);
  assert.ok(raw.includes(hash));
  assert.ok(!raw.includes('secret text'));
  record.phase='paid';saveSession(s,record);
  assert.equal(loadSession(s).phase,'paid');
});
test('corrupt recovery record fails closed',async()=>{
  const {envelope,hash,invoice}=await fixture(),s=store();
  const record=createSession(invoice,envelope,hash);
  assert.equal(validSession({...record,attempt_id:'invalid'}),false);
  assert.equal(validSession({...record,phase:'accepted'}),false);
  s.setItem(STORAGE_KEY,'{truncated');
  assert.throws(()=>loadSession(s),/corrupt/);
  assert.throws(()=>saveSession({setItem(){throw Error('storage disabled')}},record),/storage disabled/);
});
