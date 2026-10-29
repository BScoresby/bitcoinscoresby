// PREVIEW TEST ONLY: gets a Rizful BOLT11 invoice for a bound contact attempt.
// Not proof of payment; does not authorize Nostr publication.
const LNURL = 'https://rizful.com/.well-known/lnurlp/scoresby';
const SIGNER = 'a8661b3474e11b0e45b273dcaccc2661d7cba4df957c33335ad51bccdc5a37ee';
const RECIPIENT = '747adf8e9036ed78b47eca762bf80bc41af34df6da7bd44876cf2d27e6b7dd64';
const RELAYS = ['wss://relay.damus.io','wss://relay.primal.net'];
const HEADERS = {'Cache-Control':'no-store'};
const fail = (status,error) => Response.json({ok:false,error},{status,headers:HEADERS});
const isHex = (value,n) => typeof value==='string' && new RegExp(`^[0-9a-f]{${n}}$`,'i').test(value);
const tag = (ev,key) => ev.tags.filter(t=>Array.isArray(t)&&t[0]===key);
const hex = bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const validCallback = value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(u.hostname==='rizful.com'||u.hostname.endsWith('.rizful.com'));}catch{return false;}};
async function jsonFetch(url){
 const response=await fetch(url,{headers:{Accept:'application/json'},redirect:'manual',signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error(`Rizful HTTP ${response.status}`);
 return response.json();
}
export async function onRequestPost({request,env}) {
 if(!env.CONTACT_DB)return fail(503,'D1 binding unavailable');
 if(Number(request.headers.get('content-length')||0)>12000)return fail(413,'Payload too large');
 let data;
 try{const text=await request.text();if(text.length>12000)return fail(413,'Payload too large');data=JSON.parse(text);}catch{return fail(400,'Invalid JSON');}
 const id=data?.attempt_id, ev=data?.request;
 if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id))return fail(400,'Invalid attempt ID');
 if(!ev||ev.kind!==9734||!isHex(ev.id,64)||!isHex(ev.pubkey,64)||!isHex(ev.sig,128)||
   !Number.isInteger(ev.created_at)||typeof ev.content!=='string'||ev.content.length>512||!Array.isArray(ev.tags)||ev.tags.length>15)
   return fail(400,'Invalid zap request');
 const one=(key)=>tag(ev,key).length===1?tag(ev,key)[0]:null;
 if(one('amount')?.[1]!=='21000'||one('p')?.[1]?.toLowerCase()!==RECIPIENT||
   JSON.stringify(one('relays')?.slice(1))!==JSON.stringify(RELAYS)||!one('lnurl')||
   tag(ev,'e').length||tag(ev,'a').length)return fail(400,'Unexpected zap tags');
 const computed=hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([0,ev.pubkey,ev.created_at,ev.kind,ev.tags,ev.content])))));
 if(computed!==ev.id.toLowerCase())return fail(400,'Zap event hash does not match');
 const now=Math.floor(Date.now()/1000);
 let row;
 try{row=await env.CONTACT_DB.prepare('SELECT nonce,state,expires_at,created_at FROM contact_attempts WHERE id=?').bind(id).first();}
 catch(error){console.error('D1 invoice read:',error);return fail(503,'Database unavailable');}
 if(!row)return fail(404,'Unknown attempt');
 if(row.state!=='created')return fail(409,'Attempt is not new');
 if(row.expires_at<=now)return fail(410,'Attempt expired');
 if(!ev.content.includes(row.nonce)||Math.abs(ev.created_at-row.created_at)>300)return fail(400,'Zap request not bound to attempt');
 try{
   const info=await jsonFetch(LNURL);
   if(info.tag!=='payRequest'||info.allowsNostr!==true||info.nostrPubkey?.toLowerCase()!==SIGNER||
      info.minSendable>21000||info.maxSendable<21000||!validCallback(info.callback))
      return fail(502,'Rizful LNURL metadata unexpected');
   const url=new URL(info.callback);
   url.searchParams.set('amount','21000');
   url.searchParams.set('nostr',JSON.stringify(ev));
   url.searchParams.set('lnurl',one('lnurl')[1]);
   const invoice=await jsonFetch(url.toString());
   if(invoice.status==='ERROR'||typeof invoice.pr!=='string'||!/^lnbc/i.test(invoice.pr))return fail(502,'No valid Rizful invoice');
   return Response.json({ok:true,attempt_id:id,request_id:ev.id,invoice:invoice.pr,
     note:'PREVIEW: invoice is NOT registered or verified; call /register before verification.'},{headers:HEADERS});
 }catch(error){console.error('Rizful invoice test:',error);return fail(502,'Rizful invoice request failed');}
}
