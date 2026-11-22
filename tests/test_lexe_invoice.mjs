import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeBolt11 } from '../lib/contact-v2/bolt11.js';
import { onRequestPost, onRequestGet } from '../functions/api/contact-v2/invoice.js';

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GEN = [0x3b6a57b2,0x26508e6d,0x1ea119fa,0x3d4233dd,0x2a1462b3];
function polymod(xs) { let chk=1; for(const x of xs){const top=chk>>>25;chk=((chk&0x1ffffff)<<5)^x;for(let i=0;i<5;i++)if((top>>>i)&1)chk^=GEN[i];}return chk>>>0; }
function encWords(bytes) {let val=0,bits=0,out=[];for(const b of bytes){val=(val<<8)|b;bits+=8;while(bits>=5){bits-=5;out.push((val>>>bits)&31);}}if(bits)out.push((val<<(5-bits))&31);return out;}
function encodeFakeInvoice(msat=21000) {
  const hrp=`lnbc${msat/100}n`;
  if (msat%100) throw Error('test invoices only multiples of 100msat');
  const ts=Math.floor(Date.now()/1000);
  const t=[];for(let i=6;i>=0;i--)t.push((ts>>> (i*5)) &31); // JS shifts wrap for >=32 but current epoch < 2^32
  const hash = new Uint8Array(32).fill(7);
  const p=encWords(hash), x=[3,16];
  const data = t.concat([CHARSET.indexOf('p'),p.length>>>5,p.length&31,...p,CHARSET.indexOf('x'),0,x.length,...x],new Array(104).fill(0));
  const expanded=[...hrp].map(c=>c.charCodeAt(0)>>>5).concat([0],[...hrp].map(c=>c.charCodeAt(0)&31));
  const values=expanded.concat(data,[0,0,0,0,0,0]);
  const check=polymod(values)^1;
  const checksum=Array.from({length:6},(_,i)=>(check>>>(5*(5-i)))&31);
  return hrp+'1'+data.concat(checksum).map(v=>CHARSET[v]).join('');
}
const fakeInvoice = encodeFakeInvoice();

test('correct 21-sat invoice returns payment hash and expiry', () => {
 const inv = decodeBolt11(fakeInvoice);
 assert.equal(inv.amount_msat,21000);
 assert.equal(inv.payment_hash,'07'.repeat(32));
 assert.ok(inv.invoice_expires_at > Date.now()/1000);
});

test('reject invalid checksum and wrong amount', () => {
 assert.throws(()=>decodeBolt11(fakeInvoice.slice(0,-1)+(fakeInvoice.endsWith('p')?'q':'p')));
 assert.equal(decodeBolt11(encodeFakeInvoice(22000)).amount_msat,22000);
});

const COMMIT = 'f'.repeat(64);
const RECIPIENT = 'A'.repeat(43);
const request = (body={envelope_hash:COMMIT}) => new Request('https://preview.example/api/contact-v2/invoice', {
  method:'POST',headers:{'Content-Type':'application/json','CF-Connecting-IP':'203.0.113.10'},body:JSON.stringify(body)
});
function mockEnv(limit=8) {
  const saved=[];let used=0;
  const db={prepare(sql){
    if (/INSERT INTO contact_v2_invoice_rate_limits/.test(sql)) return {bind(){return {async first(){return ++used <= limit ? {requests:used}:null;}};}};
    if (/INSERT INTO contact_v2_attempts/.test(sql)) return {bind(...args){return {async run(){saved.push(args);return {success:true};}};}};
    throw Error(`Unexpected SQL ${sql}`);
  }};
  return {saved, env:{LEXE_USERNAME:'test',CONTACT_V2_INVOICE_ENABLED:'true',CONTACT_V2_RATE_LIMIT_SECRET:'secret-key'.repeat(5),CONTACT_V2_RECIPIENT_PUBLIC_KEY:RECIPIENT,CONTACT_DB:db}};
}
const metadata = {tag:'payRequest',callback:'https://lexe.app/public/v1/lnurl_pay/test',minSendable:1000,maxSendable:100000};
const issued = {pr:fakeInvoice,verify:'https://lexe.app/public/v1/lnurl_verify/test'};
async function withFetch(mock,fn){const previous=globalThis.fetch;globalThis.fetch=mock;try{return await fn();}finally{globalThis.fetch=previous;}}
const ctx=(env,requestBody=request())=>({request:requestBody,env,waitUntil:()=>{}});

test('disabled invoice endpoint never calls Lexe or D1',async()=>{
 const r=await onRequestPost({request:request(),env:{}});assert.equal(r.status,404);
});
test('recipient public key is served without hitting Lexe',()=>{
 const {env}=mockEnv();const response=onRequestGet({env});assert.equal(response.status,200);
 assert.equal(response.headers.get('cache-control'),'no-store');
});
test('invoice stores envelope hash but no ciphertext',async()=>{
 const {saved,env}=mockEnv();let count=0;
 await withFetch(()=>Response.json(++count===1?metadata:issued),async()=>{
  const r=await onRequestPost(ctx(env));assert.equal(r.status,201);
  const body=await r.json();assert.equal(body.envelope_hash,COMMIT);
  assert.equal(saved.length,1);assert.equal(saved[0].at(-1),COMMIT);
  assert.equal(saved[0][2],'07'.repeat(32));assert.equal(count,2);
  assert.ok(!JSON.stringify(saved).includes('plaintext'));
 });
});
test('invalid commitment cannot trigger Lexe or D1',async()=>{
 let called=false;
 await withFetch(()=>{called=true;throw Error('should not fetch');},async()=>{
  const {env}=mockEnv();const r=await onRequestPost(ctx(env,request({envelope_hash:'invalid'})));
  assert.equal(r.status,400);assert.equal(called,false);
 });
});
test('ninth invoice request blocked before contacting Lexe',async()=>{
 const {saved,env}=mockEnv();let called=0;
 await withFetch(()=>Response.json(++called%2===1?metadata:issued),async()=>{
  for(let i=0;i<8;i++)assert.equal((await onRequestPost(ctx(env))).status,201);
  assert.equal((await onRequestPost(ctx(env))).status,429);
 });
 assert.equal(saved.length,8);assert.equal(called,16);
});
test('off-origin callback rejected before issuance',async()=>{
 const {env}=mockEnv(),calls=[];
 await withFetch(url=>{calls.push(url);return Response.json({...metadata,callback:'https://evil.example/issue'});},async()=>{
  const r=await onRequestPost(ctx(env));assert.equal(r.status,503);assert.equal(calls.length,1);
 });
});
test('wrong invoice amount rejected without storing attempt',async()=>{
 const {env,saved}=mockEnv();let count=0;
 await withFetch(()=>Response.json(++count===1?metadata:{...issued,pr:encodeFakeInvoice(22000)}),async()=>{
  const r=await onRequestPost(ctx(env));assert.equal(r.status,503);assert.equal(saved.length,0);
 });
});
