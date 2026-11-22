// Encrypted-message acceptance: no decryption, signatures, relay calls, or Lexe requests.
// The D1 trigger atomically consumes one verified payment per accepted envelope.
import { canonicalEnvelope, hashEnvelope, validEnvelope, validRecipient } from '../../contact-v2/envelope.mjs';

const MAX_REQUEST_BYTES = 14500;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEADERS = { 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'", 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
const reply = (status, data) => Response.json(data, { status, headers: HEADERS });

async function readBody(request) {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw Error('Content-Type must be application/json');
  const len = request.headers.get('content-length');
  if (len !== null && (!/^\d+$/.test(len) || Number(len) > MAX_REQUEST_BYTES)) throw Error('Request too large');
  if (!request.body) throw Error('Body required');
  const reader = request.body.getReader(), parts = [];
  let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_REQUEST_BYTES) { await reader.cancel().catch(() => {}); throw Error('Request too large'); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {bytes.set(part, offset); offset += part.byteLength;}
  const input = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes));
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Invalid JSON');
  return input;
}
async function getAccepted(db, id) {
  return db.prepare('SELECT seq, event_id, event_json FROM contact_v2_messages WHERE attempt_id = ?').bind(id).first();
}
export async function acceptRequest({request, env}) {
  if (env.CONTACT_V2_ACCEPT_ENABLED !== 'true') return reply(404, {ok:false,error:'Endpoint disabled'});
  if (!env.CONTACT_DB || !validRecipient(env.CONTACT_V2_RECIPIENT_PUBLIC_KEY)) return reply(503, {ok:false,error:'Contact inbox not configured'});
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return reply(403, {ok:false,error:'Cross-origin request rejected'});
  let input, data, messageId;
  try {
    input = await readBody(request);
    if (!UUID.test(input.attempt_id) || !validEnvelope(input.envelope) ||
        input.envelope.recipient !== env.CONTACT_V2_RECIPIENT_PUBLIC_KEY) throw Error('Invalid recipient or encrypted message');
    data = canonicalEnvelope(input.envelope);
    if (new TextEncoder().encode(data).byteLength > 14000) throw Error('Encrypted message too large');
    messageId = await hashEnvelope(input.envelope);
  } catch {
    return reply(400, {ok:false,error:'Invalid encrypted submission'});
  }
  try {
    const attempt = await env.CONTACT_DB.prepare(`
      SELECT state, paid_at, amount_msat, envelope_hash FROM contact_v2_attempts WHERE id = ?
    `).bind(input.attempt_id).first();
    if (!attempt) return reply(404, {ok:false,error:'Unknown payment attempt'});
    // Invoice-to-envelope binding; reject substitution BEFORE any storage write.
    if (attempt.envelope_hash !== messageId) return reply(409, {ok:false,error:'Encrypted message does not match invoice'});
    if (attempt.state === 'accepted') {
      const saved = await getAccepted(env.CONTACT_DB, input.attempt_id);
      return saved?.event_id === messageId && saved.event_json === data
        ? reply(200, {ok:true,state:'accepted',message_id:messageId,seq:saved.seq,already_accepted:true})
        : reply(409, {ok:false,error:'Payment already consumed'});
    }
    if (attempt.state !== 'paid' || attempt.paid_at == null || attempt.amount_msat !== 21000) {
      return reply(409, {ok:false,error:'Payment not verified'});
    }
    let inserted = false;
    try {
      const result = await env.CONTACT_DB.prepare(`
        INSERT INTO contact_v2_messages (attempt_id, event_id, event_json, accepted_at)
        SELECT id, ?, ?, ? FROM contact_v2_attempts
        WHERE id = ? AND state = 'paid' AND paid_at IS NOT NULL
          AND amount_msat = 21000 AND envelope_hash = ?
      `).bind(messageId, data, Math.floor(Date.now()/1000), input.attempt_id, messageId).run();
      inserted = Number.isSafeInteger(result?.meta?.changes) && result.meta.changes > 0;
    } catch { /* A concurrent request or constraint can win; read the committed result. */ }
    const saved = await getAccepted(env.CONTACT_DB, input.attempt_id);
    if (saved?.event_id === messageId && saved.event_json === data) {
      return reply(inserted ? 201 : 200, {ok:true,state:'accepted',message_id:messageId,seq:saved.seq,already_accepted:!inserted});
    }
    if (saved) return reply(409, {ok:false,error:'Payment already consumed'});
    return reply(503, {ok:false,error:'Encrypted message not yet stored; retry the same attempt'});
  } catch (error) {
    console.error('Contact v2 acceptance unavailable:', error?.name || 'Error');
    return reply(503, {ok:false,error:'Message storage temporarily unavailable'});
  }
}
