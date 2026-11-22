import { canonicalEnvelope, hashEnvelope, validEnvelope } from '../../contact-v2/envelope.mjs';
// Contact v2 read-only inbox endpoint.
// No writes, relay calls, decryption or recipient private key handling.
// The 32-byte random client token is stored locally; only its SHA-256 digest
// is stored as the CONTACT_V2_INBOX_TOKEN_SHA256 Cloudflare encrypted secret.

const HEX64 = /^[0-9a-f]{64}$/;
const TOKEN = /^[A-Za-z0-9_-]{43}$/; // Python secrets.token_urlsafe(32)
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 25;
const MAX_EVENT_JSON_CHARS = 15000;
const BASE_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

function reply(status, data, extra = {}) {
  return Response.json(data, { status, headers: { ...BASE_HEADERS, ...extra } });
}

function parseUnsignedInt(value, max, fallback) {
  if (value == null) return fallback;
  if (!/^(0|[1-9][0-9]*)$/.test(value) || value.length > 16) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 && number <= max ? number : null;
}

async function authorized(header, expectedHexDigest) {
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(header || '');
  if (!match) return false;
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(match[1]))
  );
  // Compare exactly 32 bytes without early-exiting on a differing byte.
  let difference = 0;
  for (let i = 0; i < 32; i++) {
    difference |= digest[i] ^ Number.parseInt(expectedHexDigest.slice(i * 2, i * 2 + 2), 16);
  }
  return difference === 0;
}

async function parseStoredEvent(row) {
  if (!Number.isSafeInteger(row.seq) || row.seq < 1 ||
      !Number.isSafeInteger(row.accepted_at) || row.accepted_at <= 0 ||
      typeof row.event_id !== 'string' || !HEX64.test(row.event_id) ||
      typeof row.event_json !== 'string' || row.event_json.length === 0 ||
      row.event_json.length > MAX_EVENT_JSON_CHARS) {
    throw Error('Invalid accepted envelope row');
  }
  const envelope = JSON.parse(row.event_json);
  if (!validEnvelope(envelope) || canonicalEnvelope(envelope) !== row.event_json ||
      await hashEnvelope(envelope) !== row.event_id) {
    throw Error('Stored envelope commitment mismatch');
  }
  return { seq:row.seq, message_id:row.event_id, accepted_at:row.accepted_at, envelope };
}

export async function inboxRequest({ request, env }) {
  // Explicit opt-in: production stays disabled unless configured.
  if (env?.CONTACT_V2_INBOX_ENABLED !== 'true') {
    return reply(404, { ok: false, error: 'Endpoint disabled' });
  }
  if (request.method !== 'GET') {
    return reply(405, { ok: false, error: 'Method not allowed' }, { Allow: 'GET' });
  }
  const expectedHash = typeof env.CONTACT_V2_INBOX_TOKEN_SHA256 === 'string'
    ? env.CONTACT_V2_INBOX_TOKEN_SHA256.trim().toLowerCase() : '';
  if (!HEX64.test(expectedHash) || !env.CONTACT_DB) {
    return reply(503, { ok: false, error: 'Inbox not configured' });
  }
  const valid = await authorized(request.headers.get('Authorization'), expectedHash);
  if (!valid) {
    return reply(401, { ok: false, error: 'Unauthorized' },
      { 'WWW-Authenticate': 'Bearer realm="contact-v2-inbox"' });
  }
  const url = new URL(request.url);
  const allowedKeys = new Set(['after', 'limit']);
  if ([...url.searchParams.keys()].some(k => !allowedKeys.has(k)) ||
      url.searchParams.getAll('after').length > 1 || url.searchParams.getAll('limit').length > 1) {
    return reply(400, { ok: false, error: 'Invalid query parameters' });
  }
  const after = parseUnsignedInt(url.searchParams.get('after'), Number.MAX_SAFE_INTEGER, 0);
  const limit = parseUnsignedInt(url.searchParams.get('limit'), MAX_LIMIT, DEFAULT_LIMIT);
  if (after === null || limit === null || limit < 1) {
    return reply(400, { ok: false, error: 'Invalid pagination values' });
  }

  try {
    // One bounded ascending page, plus one lookahead row for has_more.
    // No JOIN to payment attempts, and NO database writes.
    const query = await env.CONTACT_DB.prepare(`
      SELECT seq, event_id, event_json, accepted_at
      FROM contact_v2_messages
      WHERE seq > ?
      ORDER BY seq ASC
      LIMIT ?
    `).bind(after, limit + 1).all();
    if (query?.success === false || !Array.isArray(query?.results) ||
        query.results.length > limit + 1) {
      throw new Error('Invalid D1 query result');
    }
    const hasMore = query.results.length > limit;
    const rows = query.results.slice(0, limit);
    let last = after;
    const messages = [];
    for (const row of rows) {
      const message = await parseStoredEvent(row);
      if (message.seq <= last) throw new Error('Non-increasing inbox cursor');
      last = message.seq;
      messages.push(message);
    }
    return reply(200, {
      ok: true,
      messages,
      next_after: last,
      has_more: hasMore,
    });
  } catch (error) {
    // Do not log the full D1 error: it could contain encrypted event text.
    console.error('Contact v2 inbox query failed');
    return reply(503, { ok: false, error: 'Inbox temporarily unavailable' });
  }
}
