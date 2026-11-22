import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inboxRequest} from '../lib/contact-v2/inbox-core.js';
import {encryptEnvelope,hashEnvelope,canonicalEnvelope,toBase64Url} from '../contact-v2/envelope.mjs';
const TOKEN='t'.repeat(43), HASH=createHash('sha256').update(TOKEN).digest('hex');
async function makeRow(seq, overrides={}) {
  const pair=await crypto.subtle.generateKey('X25519',true,['deriveBits']);
  const recipient=toBase64Url(await crypto.subtle.exportKey('raw',pair.publicKey));
  const envelope=await encryptEnvelope(`secret-${seq}`,recipient);
  return {seq,accepted_at:1795200000+seq,event_id:await hashEnvelope(envelope),event_json:canonicalEnvelope(envelope),...overrides};
}
function makeDb(rows,fail=false) {return {prepare(sql){assert.match(sql,/FROM contact_v2_messages/);return {bind(after,count){return {async all(){if(fail)throw Error('hidden');return {success:true,results:rows.filter(r=>r.seq>after).slice(0,count)};}};}};}};}
const env=db=>({CONTACT_V2_INBOX_ENABLED:'true',CONTACT_V2_INBOX_TOKEN_SHA256:HASH,CONTACT_DB:db});
const req=(path='/api/contact-v2/inbox',token=TOKEN)=>new Request('https://preview.example'+path,{headers:token?{Authorization:`Bearer ${token}`}:{}});
test('unauthorized inbox never accesses D1',async()=>{
 const r=await inboxRequest({request:req(undefined,null),env:env({prepare(){throw Error('Must not query D1');}})});
 assert.equal(r.status,401);
});
test('authenticated inbox serves checked ciphertext, no payment metadata',async()=>{
 const row=await makeRow(1), r=await inboxRequest({request:req(),env:env(makeDb([row]))});
 assert.equal(r.status,200);const body=await r.json();
 assert.equal(body.messages[0].message_id,row.event_id);
 assert.equal(body.messages[0].envelope.v,1);
 assert.equal(body.has_more,false);
 assert.equal(body.next_after,1);
 assert.equal(JSON.stringify(body).includes('attempt_id'),false);
});
test('pagination and tampering checks',async()=>{
 const rows=[await makeRow(1),await makeRow(4),await makeRow(8)];
 const a=await (await inboxRequest({request:req('/api/contact-v2/inbox?limit=2'),env:env(makeDb(rows))})).json();
 assert.equal(a.messages.length,2);assert.equal(a.has_more,true);
 const b=await (await inboxRequest({request:req(`/api/contact-v2/inbox?after=${a.next_after}&limit=2`),env:env(makeDb(rows))})).json();
 assert.deepEqual(b.messages.map(m=>m.seq),[8]);
 const tampered=await inboxRequest({request:req(),env:env(makeDb([{...rows[0],event_id:'f'.repeat(64)}]))});
 assert.equal(tampered.status,503);
});
test('invalid query is rejected',async()=>{
 const r=await inboxRequest({request:req('/api/contact-v2/inbox?limit=500'),env:env(makeDb([]))});assert.equal(r.status,400);
});
