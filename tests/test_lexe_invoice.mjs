import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeBolt11 } from '../lib/contact-v2/bolt11.js';
import { onRequestPost } from '../functions/api/contact-v2/invoice.js';

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
 assert.throws(()=>decodeBolt11(fakeInvoice.slice(0,-1)+'p'));
 assert.equal(decodeBolt11(encodeFakeInvoice(22000)).amount_msat,22000);
});

test('disabled endpoint never calls Lexe or D1', async () => {
 let hit=false;
 const prior=globalThis.fetch;
 globalThis.fetch=async()=>{hit=true;throw Error('unexpected fetch');};
 try {
   const r=await onRequestPost({request:new Request('https://preview.example/api/contact-v2/invoice',{method:'POST'}),env:{}});
   assert.equal(r.status,404);
   assert.equal(hit,false);
 } finally {globalThis.fetch=prior;}
});

test('invoice endpoint stores one unpaid attempt without any ciphertext', async () => {
 const original=globalThis.fetch;
 const calls=[];
 globalThis.fetch=async url=>{
   calls.push(String(url));
   return Response.json(calls.length===1
    ? {tag:'payRequest',callback:'https://lexe.app/public/v1/lnurl_pay/test',minSendable:1000,maxSendable:100000}
    : {pr:fakeInvoice,verify:'https://lexe.app/public/v1/lnurl_verify/test'});
 };
 const saved=[];
 const env = {
   LEXE_USERNAME: 'test', CONTACT_V2_INVOICE_ENABLED: 'true',
   CONTACT_DB: { prepare(sql) {
     assert.match(sql, /INSERT INTO contact_v2_attempts/);
     return { bind(...args) { return { async run() { saved.push(args); } }; } };
   } }
 };
 try {
  const r=await onRequestPost({request:new Request('https://preview.example/api/contact-v2/invoice',{method:'POST'}),env});
  assert.equal(r.status,201);
  const body=await r.json();
  assert.equal(body.ok,true);
  assert.equal(body.amount_msat,21000);
  assert.equal(saved.length,1);
  assert.equal(saved[0][2],'07'.repeat(32));
  assert.equal(calls.length,2);
  assert.match(calls[1],/amount=21000/);
 } finally {globalThis.fetch=original;}
});

test('rejects callback URLs outside Lexe before requesting an invoice', async () => {
 const original=globalThis.fetch;
 const calls=[];
 globalThis.fetch=async url=>{
   calls.push(String(url));
   return Response.json({tag:'payRequest',callback:'https://evil.example/issue',minSendable:1000,maxSendable:100000});
 };
 try {
  const response = await onRequestPost({
    request:new Request('https://preview.example/api/contact-v2/invoice',{method:'POST'}),
    env:{LEXE_USERNAME:'test',CONTACT_V2_INVOICE_ENABLED:'true',CONTACT_DB:{prepare(){throw Error('DB must not be touched');}}}
  });
  assert.equal(response.status,503);
  assert.equal(calls.length,1);
 } finally {globalThis.fetch=original;}
});

test('rejects invoices with the wrong amount without recording payment attempt', async () => {
 const original=globalThis.fetch;
 let calls=0;
 globalThis.fetch=async () => Response.json(++calls===1
   ? {tag:'payRequest',callback:'https://lexe.app/public/v1/lnurl_pay/test',minSendable:1000,maxSendable:100000}
   : {pr:encodeFakeInvoice(22000), verify:'https://lexe.app/public/v1/lnurl_verify/test'});
 try {
  const response = await onRequestPost({
    request:new Request('https://preview.example/api/contact-v2/invoice',{method:'POST'}),
    env:{LEXE_USERNAME:'test',CONTACT_V2_INVOICE_ENABLED:'true',CONTACT_DB:{prepare(){throw Error('DB must not be touched');}}}
  });
  assert.equal(response.status,503);
  assert.equal(calls,2);
 } finally {globalThis.fetch=original;}
});
