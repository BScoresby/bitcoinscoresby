// Contact v2: payment-gated, immutable encrypted-message acceptance.
// No Lightning verification, relay access or decryption occurs here.
// The caller supplies a NIP-17 signature/shape validator.

const MAX_REQUEST_BYTES = 16384;
const MAX_EVENT_BYTES = 14500; // Less than D1 contact_v2_messages CHECK <= 15000.
const HEX64 = /^[0-9a-f]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENT_FIELDS = ['content', 'created_at', 'id', 'kind', 'pubkey', 'sig', 'tags'];
const HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};
const reply = (status, data) => Response.json(data, { status, headers: HEADERS });

class BadRequest extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function boundedJson(request) {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new BadRequest(415, 'Content-Type must be application/json');
  }
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_REQUEST_BYTES)) {
    throw new BadRequest(413, 'Request too large');
  }
  if (!request.body) throw new BadRequest(400, 'JSON body required');
  const reader = request.body.getReader();
  const parts = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_REQUEST_BYTES) {
        await reader.cancel().catch(() => {});
        throw new BadRequest(413, 'Request too large');
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const buffer = new Uint8Array(bytes);
  let offset = 0;
  for (const part of parts) { buffer.set(part, offset); offset += part.byteLength; }
  try {
    const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error();
    return data;
  } catch {
    throw new BadRequest(400, 'Malformed JSON object');
  }
}

function canonicalEvent(value, recipient) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).sort().join(',') !== EVENT_FIELDS.join(',')) {
    throw new BadRequest(400, 'Invalid encrypted event fields');
  }
  if (!HEX64.test(value.id) || !HEX64.test(value.pubkey) ||
      typeof value.sig !== 'string' || !/^[0-9a-f]{128}$/.test(value.sig) ||
      value.kind !== 1059 || !Number.isSafeInteger(value.created_at) ||
      !Array.isArray(value.tags) || value.tags.length !== 1 ||
      !Array.isArray(value.tags[0]) || value.tags[0].length !== 2 ||
      value.tags[0][0] !== 'p' || value.tags[0][1] !== recipient ||
      typeof value.content !== 'string' || value.content.length > 10000) {
    throw new BadRequest(400, 'Invalid NIP-17 gift wrap');
  }
  // Fixed property order means key reordering in JSON does not create a
  // different retry payload. No unsigned extra fields are persisted.
  const event = {
    kind: value.kind, created_at: value.created_at, tags: value.tags,
    content: value.content, pubkey: value.pubkey, id: value.id, sig: value.sig,
  };
  const eventJSON = JSON.stringify(event);
  if (new TextEncoder().encode(eventJSON).byteLength > MAX_EVENT_BYTES) {
    throw new BadRequest(413, 'Encrypted event too large');
  }
  return { event, eventJSON };
}

async function getAttempt(db, id) {
  return db.prepare(`
    SELECT id, state, paid_at, amount_msat
    FROM contact_v2_attempts WHERE id = ?
  `).bind(id).first();
}
async function getAccepted(db, id) {
  return db.prepare(`
    SELECT seq, event_id, event_json FROM contact_v2_messages
    WHERE attempt_id = ?
  `).bind(id).first();
}

/** Tests can inject a validator. Production supplies the existing project's
 *  server-side NIP-17 signature validator. */
export async function acceptRequest({ request, env }, validateGiftWrap) {
  if (env.CONTACT_V2_ACCEPT_ENABLED !== 'true') {
    return reply(404, { ok: false, error: 'Endpoint disabled' });
  }
  if (!env.CONTACT_DB) return reply(503, { ok: false, error: 'Contact database unavailable' });
  const expectedRecipient = typeof env.CONTACT_INBOX_PUBKEY === 'string'
    ? env.CONTACT_INBOX_PUBKEY.trim().toLowerCase() : '';
  if (!HEX64.test(expectedRecipient)) {
    return reply(503, { ok: false, error: 'Contact inbox not configured' });
  }
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return reply(403, { ok: false, error: 'Cross-origin request rejected' });
  }
  let input;
  try { input = await boundedJson(request); }
  catch (error) {
    return reply(error instanceof BadRequest ? error.status : 400,
      { ok: false, error: error instanceof BadRequest ? error.message : 'Invalid request' });
  }
  const id = input.attempt_id;
  if (typeof id !== 'string' || !UUID.test(id)) {
    return reply(400, { ok: false, error: 'Invalid payment attempt ID' });
  }
  let event, eventJSON;
  try { ({ event, eventJSON } = canonicalEvent(input.event, expectedRecipient)); }
  catch (error) {
    return reply(error instanceof BadRequest ? error.status : 400,
      { ok: false, error: error instanceof BadRequest ? error.message : 'Invalid event' });
  }
  try {
    // Cheap D1 lookup BEFORE cryptographic verification; the INSERT below is
    // independently conditioned on paid state, guarding all concurrent races.
    const attempt = await getAttempt(env.CONTACT_DB, id);
    if (!attempt) return reply(404, { ok: false, error: 'Unknown payment attempt' });
    if (attempt.state === 'accepted') {
      const saved = await getAccepted(env.CONTACT_DB, id);
      if (saved && saved.event_id === event.id && saved.event_json === eventJSON) {
        return reply(200, { ok: true, state: 'accepted', event_id: event.id, seq: saved.seq, already_accepted: true });
      }
      return reply(409, { ok: false, error: 'Payment already used for another event' });
    }
    if (attempt.state !== 'paid' || attempt.paid_at == null || attempt.amount_msat !== 21000) {
      return reply(409, { ok: false, error: 'Payment not verified' });
    }

    // Do not trust the browser's event ID or claimed recipient. The existing
    // validator checks signature, hash, NIP-44 format, time and recipient.
    let valid = false;
    try { valid = await validateGiftWrap(event, expectedRecipient); } catch { valid = false; }
    if (!valid) return reply(400, { ok: false, error: 'Invalid NIP-17 gift wrap' });

    const now = Math.floor(Date.now() / 1000);
    let inserted = false;
    try {
      // This is a SINGLE atomic SQLite statement. The existing DB trigger
      // requires state='paid' and transitions it to 'accepted' upon INSERT.
      // UNIQUE(attempt_id) and UNIQUE(event_id) prevent payment/event reuse.
      const result = await env.CONTACT_DB.prepare(`
        INSERT INTO contact_v2_messages (attempt_id, event_id, event_json, accepted_at)
        SELECT id, ?, ?, ? FROM contact_v2_attempts
        WHERE id = ? AND state = 'paid' AND paid_at IS NOT NULL AND amount_msat = 21000
      `).bind(event.id, eventJSON, now, id).run();
      // D1 meta.changes uses SQLite total_changes(), which also counts
      // the AFTER INSERT trigger updating contact_v2_attempts.
      inserted = Number.isSafeInteger(result?.meta?.changes) && result.meta.changes > 0;
    } catch {
      // A competing submission can violate a UNIQUE constraint. Re-read the
      // committed winner instead of exposing SQLite internals to the browser.
    }
    if (inserted) {
      const stored = await getAccepted(env.CONTACT_DB, id);
      return reply(201, { ok: true, state: 'accepted', event_id: event.id,
        seq: stored?.seq ?? null, already_accepted: false });
    }
    const saved = await getAccepted(env.CONTACT_DB, id);
    if (saved) {
      return saved.event_id === event.id && saved.event_json === eventJSON
        ? reply(200, { ok: true, state: 'accepted', event_id: event.id, seq: saved.seq, already_accepted: true })
        : reply(409, { ok: false, error: 'Payment already used for another event' });
    }
    // A UNIQUE(event_id) conflict may mean this very same gift wrap was
    // redeemed under another payment. Refuse reuse without revealing who.
    const priorEvent = await env.CONTACT_DB.prepare(`
      SELECT event_id FROM contact_v2_messages WHERE event_id = ?
    `).bind(event.id).first();
    if (priorEvent) return reply(409, { ok: false, error: 'Encrypted event already accepted' });
    return reply(503, { ok: false, error: 'Message was not accepted; retry the same event' });
  } catch (error) {
    // Never log ciphertext, invoice, key material or the request body.
    console.error('Contact v2 accept storage failure:', error?.name || 'Error');
    return reply(503, { ok: false, error: 'Message storage temporarily unavailable' });
  }
}
