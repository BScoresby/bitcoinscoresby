// PREVIEW-ONLY: provisional registration. Does NOT authorize paid messages.
const RECIPIENT = '747adf8e9036ed78b47eca762bf80bc41af34df6da7bd44876cf2d27e6b7dd64'; // replaced dynamically below
const AMOUNT = '21000';
const ALLOWED_RELAYS = ['wss://relay.damus.io', 'wss://relay.primal.net'];
const MAX_BODY = 16000;
const HEADERS = {'Cache-Control': 'no-store'};
function fail(status, error) { return Response.json({ok:false,error},{status,headers:HEADERS}); }
function tag(event, key) { return event.tags.find(t => Array.isArray(t) && t[0] === key); }
function hex(s,n) { return typeof s === 'string' && new RegExp(`^[0-9a-f]{${n}}$`,'i').test(s); }
function bytesToHex(b) { return [...b].map(v=>v.toString(16).padStart(2,'0')).join(''); }
async function eventHash(ev) {
  const payload=JSON.stringify([0,ev.pubkey,ev.created_at,ev.kind,ev.tags,ev.content]);
  return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(payload))));
}
export async function onRequestPost({request,env}) {
  if (!env.CONTACT_DB) return fail(503,'Database unavailable');
  if (Number(request.headers.get('content-length') || 0)>MAX_BODY) return fail(413,'Request too large');
  let body;
  try {const raw=await request.text();if(raw.length>MAX_BODY)return fail(413,'Request too large');body=JSON.parse(raw);} catch {return fail(400,'Invalid JSON');}
  const {attempt_id, request:zap, invoice}=body||{};
  if (!/^[0-9a-f-]{36}$/i.test(attempt_id||'')) return fail(400,'Invalid attempt ID');
  if (!zap||zap.kind!==9734||!hex(zap.id,64)||!hex(zap.sig,128)||!hex(zap.pubkey,64)||
      !Number.isInteger(zap.created_at)||!Array.isArray(zap.tags)||typeof zap.content!=='string'||zap.content.length>512)
    return fail(400,'Invalid zap request structure');
  if (typeof invoice!=='string'||invoice.length>10000||!/^(lnbc|LNBC)/.test(invoice)) return fail(400,'Invalid invoice format');
  if (invoice.toLowerCase()===invoice.toUpperCase()) return fail(400,'Invalid invoice');
  if (tag(zap,'amount')?.[1]!==AMOUNT || tag(zap,'p')?.[1]?.toLowerCase()!==RECIPIENT ||
      JSON.stringify(tag(zap,'relays')?.slice(1))!==JSON.stringify(ALLOWED_RELAYS))
    return fail(400,'Unexpected zap request tags');
  const hash=await eventHash(zap);
  if (hash!==zap.id.toLowerCase()) return fail(400,'Zap event ID mismatch');
  const now=Math.floor(Date.now()/1000);
  try {
    const row=await env.CONTACT_DB.prepare('SELECT id, nonce, state, expires_at, created_at FROM contact_attempts WHERE id = ?')
      .bind(attempt_id).first();
    if (!row) return fail(404,'Unknown payment attempt');
    if (row.state!=='created') return fail(409,'Attempt already registered');
    if (row.expires_at<=now) return fail(410,'Attempt expired');
    if (!zap.content.includes(row.nonce)) return fail(400,'Request does not contain issued nonce');
    if (Math.abs(zap.created_at-row.created_at)>300) return fail(400,'Request timestamp not in attempt window');
    const result=await env.CONTACT_DB.prepare(`UPDATE contact_attempts SET zap_request_id=?, invoice=?, state='invoiced' WHERE id=? AND state='created' AND expires_at>?`)
      .bind(zap.id.toLowerCase(),invoice,attempt_id,now).run();
    if (result.meta?.changes!==1) return fail(409,'Attempt already used or expired');
    return Response.json({ok:true,attempt_id,zap_request_id:zap.id,state:'invoiced',note:'Registration only; payment NOT verified'},{headers:HEADERS});
  } catch(e) {console.error('Contact registration:',e);return fail(503,'Registration failed');}
}
