import test from 'node:test';
import assert from 'node:assert/strict';
import {acceptRequest} from '../lib/contact-v2/accept-core.js';
import {encryptEnvelope,hashEnvelope,toBase64Url} from '../contact-v2/envelope.mjs';
const ID='430edf9f-7e11-4174-8745-2851bb8a2261';
async function fixture() {
 const pair=await crypto.subtle.generateKey('X25519',true,['deriveBits']);
 const recipient=toBase64Url(await crypto.subtle.exportKey('raw',pair.publicKey));
 const envelope=await encryptEnvelope('secret',recipient), hash=await hashEnvelope(envelope);
 return {recipient,envelope,hash};
}
function db(hash,state='paid') {
 const row={state,paid_at:state==='invoiced'?null:100,amount_msat:21000,envelope_hash:hash};
 let saved=null, inserts=0;
 return {row,get saved(){return saved;},get inserts(){return inserts;},prepare(sql){
   if (/SELECT state, paid_at, amount_msat, envelope_hash/.test(sql)) return {bind(id){assert.equal(id,ID);return {async first(){return row;}};}};
   if (/SELECT seq, event_id, event_json/.test(sql)) return {bind(id){assert.equal(id,ID);return {async first(){return saved;}};}};
   if (/INSERT INTO contact_v2_messages/.test(sql)) return {bind(messageId,data,now,id,commitment){return {async run(){
     assert.equal(id,ID);assert.equal(commitment,messageId);
     if (row.state!=='paid'||hash!==messageId||saved)return {meta:{changes:0}};
     saved={seq:1,event_id:messageId,event_json:data};row.state='accepted';inserts++;
     return {meta:{changes:2}};
   }};}};
   throw Error(`Unexpected SQL: ${sql}`);
 }};
}
function req(envelope,id=ID) {return new Request('https://preview.example/api/contact-v2/accept', {
 method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({attempt_id:id,envelope})});}
function env(recipient, database){return {CONTACT_V2_ACCEPT_ENABLED:'true',CONTACT_V2_RECIPIENT_PUBLIC_KEY:recipient,CONTACT_DB:database};}
test('correctly bound paid envelope is accepted exactly once and replay is idempotent',async()=>{
 const {recipient,envelope,hash}=await fixture(),database=db(hash);
 const a=await acceptRequest({request:req(envelope),env:env(recipient,database)});
 assert.equal(a.status,201);assert.equal((await a.json()).message_id,hash);
 assert.equal(database.row.state,'accepted');
 const b=await acceptRequest({request:req(envelope),env:env(recipient,database)});
 assert.equal(b.status,200);assert.equal((await b.json()).already_accepted,true);
 assert.equal(database.inserts,1);
});
test('an unpaid invoice cannot store any envelope',async()=>{
 const {recipient,envelope,hash}=await fixture(), database=db(hash,'invoiced');
 const r=await acceptRequest({request:req(envelope),env:env(recipient,database)});
 assert.equal(r.status,409);assert.equal(database.inserts,0);
});
test('different encrypted message cannot consume a paid invoice',async()=>{
 const {recipient,envelope,hash}=await fixture(),database=db(hash);
 const other=await encryptEnvelope('substitution',recipient);
 const r=await acceptRequest({request:req(other),env:env(recipient,database)});
 assert.equal(r.status,409);assert.equal(database.inserts,0);
});
test('invalid recipient, malformed envelope and wrong origin rejected',async()=>{
 const {recipient,envelope,hash}=await fixture(), database=db(hash);
 assert.equal((await acceptRequest({request:req({...envelope,recipient:'x'}),env:env(recipient,database)})).status,400);
 assert.equal((await acceptRequest({request:req(envelope),env:env('x',database)})).status,503);
 const request=req(envelope);request.headers.set('Origin','https://evil.example');
 assert.equal((await acceptRequest({request,env:env(recipient,database)})).status,403);
 assert.equal(database.inserts,0);
});
test('disabled acceptance fails closed',async()=>{
 const r=await acceptRequest({request:req({}),env:{}});assert.equal(r.status,404);
});
