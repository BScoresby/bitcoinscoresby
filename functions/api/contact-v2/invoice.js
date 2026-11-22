import { decodeBolt11 } from '../../../lib/contact-v2/bolt11.js';
import { validRecipient } from '../../../contact-v2/envelope.mjs';

const AMOUNT_MSAT = 21000;
const NO_STORE = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
const json = (status, data) => Response.json(data, { status, headers: NO_STORE });
const validUsername = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(value);

const INVOICE_RATE_LIMIT = 5;
const INVOICE_WINDOW_SECONDS = 3600;

async function checkInvoiceRateLimit(request, env, now) {
  const ip = request.headers.get('cf-connecting-ip');
  const secret = env.CONTACT_V2_RATE_LIMIT_SECRET;

  if (!ip || typeof secret !== 'string' || secret.length < 32) {
    throw Error('Invoice rate limiter not configured');
  }

  // HMAC avoids storing the visitor's raw IP address in D1.
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, encoder.encode(ip))
  );

  const clientHash = Array.from(signature, byte =>
    byte.toString(16).padStart(2, '0')
  ).join('');

  const expiredBefore = now - INVOICE_WINDOW_SECONDS;

  // One atomic statement prevents concurrent requests from
  // independently passing a read-then-write limit check.
  const result = await env.CONTACT_DB.prepare(`
    INSERT INTO contact_v2_invoice_rate_limits
      (client_hash, window_start, requests)
    VALUES (?, ?, 1)
    ON CONFLICT(client_hash) DO UPDATE SET
      requests = CASE
        WHEN window_start <= ? THEN 1
        ELSE requests + 1
      END,
      window_start = CASE
        WHEN window_start <= ? THEN excluded.window_start
        ELSE window_start
      END
    WHERE window_start <= ? OR requests < ?
    RETURNING requests
  `).bind(
    clientHash,
    now,
    expiredBefore,
    expiredBefore,
    expiredBefore,
    INVOICE_RATE_LIMIT
  ).first();

  return result !== null;
}

function requireLexeUrl(value, verify = false) {
  let url;
  try { url = new URL(value); } catch { throw Error('Invalid Lexe URL'); }
  if (url.protocol !== 'https:' || url.hostname !== 'lexe.app' ||
      url.port || url.username || url.password || url.hash) {
    throw Error('Unexpected Lexe URL origin');
  }
  if (verify && (!/^\/public\/v1\/lnurl_verify\/[A-Za-z0-9_-]+$/.test(url.pathname) || url.search)) {
    throw Error('Unexpected Lexe verify path');
  }
  return url;
}

async function limitedJson(url) {
  const response = await fetch(url, {
    method: 'GET', redirect: 'manual', headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok || response.status >= 300 || !response.body) {
    throw Error('Lexe endpoint unavailable');
  }
  // Bound decompressed JSON bytes, not just Content-Length.
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 16384) throw Error('Lexe response too large');
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let off = 0;
  for (const chunk of chunks) { bytes.set(chunk, off); off += chunk.length; }
  const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if (data?.status === 'ERROR') throw Error('Lexe refused invoice request');
  return data;
}

// Public, cache-disabled recipient key: the browser never hardcodes an independent key.
export function onRequestGet({env}) {
  if (env.CONTACT_V2_INVOICE_ENABLED !== 'true') return json(404, {ok:false,error:'Endpoint disabled'});
  if (!validRecipient(env.CONTACT_V2_RECIPIENT_PUBLIC_KEY)) return json(503, {ok:false,error:'Recipient key not configured'});
  return json(200, {ok:true,version:1,recipient_public_key:env.CONTACT_V2_RECIPIENT_PUBLIC_KEY});
}

async function readCommitment(request) {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw Error('JSON required');
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > 256)) throw Error('Request too large');
  if (!request.body) throw Error('Request body required');
  const reader = request.body.getReader();
  const chunks = []; let total = 0;
  try {
    while (true) {
      const {done,value} = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 256) {await reader.cancel().catch(() => {}); throw Error('Request too large');}
      chunks.push(value);
    }
  } finally {reader.releaseLock();}
  const bytes = new Uint8Array(total); let offset = 0;
  for (const part of chunks) { bytes.set(part,offset); offset += part.byteLength; }
  const body = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).join(',') !== 'envelope_hash' ||
      typeof body.envelope_hash !== 'string' || !/^[0-9a-f]{64}$/.test(body.envelope_hash)) throw Error('Invalid envelope hash');
  return body.envelope_hash;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  // Development safeguard: this first endpoint is only enabled deliberately.
  if (env.CONTACT_V2_INVOICE_ENABLED !== 'true') {
    return json(404, { ok: false, error: 'Endpoint disabled' });
  }
  if (!env.CONTACT_DB || !validUsername(env.LEXE_USERNAME) ||
      !validRecipient(env.CONTACT_V2_RECIPIENT_PUBLIC_KEY)) {
    return json(503, { ok: false, error: 'Payment service not configured' });
  }
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return json(403, { ok: false, error: 'Cross-origin request rejected' });
  }
  let envelopeHash;
  try { envelopeHash = await readCommitment(request); }
  catch { return json(400, {ok:false,error:'Invalid encrypted-message commitment'}); }
  const now = Math.floor(Date.now() / 1000);
  try {
    const allowed = await checkInvoiceRateLimit(request, env, now);

    if (!allowed) {
      return json(429, {
        ok: false,
        error: 'Too many invoice requests. Try again later.'
      });
    }
    // Opportunistically remove stale rate-limit counters.
    // This runs on approximately 1% of permitted invoice requests.
    if (Math.random() < 0.01) {
      context.waitUntil(
        env.CONTACT_DB.prepare(`
          DELETE FROM contact_v2_invoice_rate_limits
          WHERE client_hash IN (
            SELECT client_hash
            FROM contact_v2_invoice_rate_limits
            WHERE window_start < ?
            LIMIT 100
          )
        `)
        .bind(now - 86400)
        .run()
        .catch(error =>
          console.error('Rate-limit cleanup failed:', error?.message)
        )
      );
    }

    // No caller-provided username, callback, amount, or verification URL.
    const metadataUrl = `https://lexe.app/.well-known/lnurlp/${env.LEXE_USERNAME}`;
    const metadata = await limitedJson(metadataUrl);
    if (metadata.tag !== 'payRequest' ||
        !Number.isSafeInteger(metadata.minSendable) ||
        !Number.isSafeInteger(metadata.maxSendable) ||
        metadata.minSendable > AMOUNT_MSAT || metadata.maxSendable < AMOUNT_MSAT) {
      throw Error('Lexe LNURL-pay amount is unavailable');
    }
    const callback = requireLexeUrl(metadata.callback);
    callback.searchParams.set('amount', String(AMOUNT_MSAT));
    const invoiceResponse = await limitedJson(callback.toString());
    const invoice = invoiceResponse.pr;
    const verify = requireLexeUrl(invoiceResponse.verify, true);
    const parsed = decodeBolt11(invoice);
    if (parsed.amount_msat !== AMOUNT_MSAT || parsed.invoice_expires_at <= now + 30) {
      throw Error('Wrong amount or expired invoice');
    }
    const attemptId = crypto.randomUUID();
    await env.CONTACT_DB.prepare(`
      INSERT INTO contact_v2_attempts
        (id, state, invoice, payment_hash, verify_url, amount_msat, created_at, invoice_expires_at, envelope_hash)
      VALUES (?, 'invoiced', ?, ?, ?, ?, ?, ?, ?)
    `).bind(attemptId, invoice, parsed.payment_hash,
      verify.toString(), AMOUNT_MSAT, now, parsed.invoice_expires_at, envelopeHash).run();
    return json(201, { ok: true, attempt_id: attemptId,
      invoice, amount_msat: AMOUNT_MSAT,
      invoice_expires_at: parsed.invoice_expires_at, envelope_hash: envelopeHash });
  } catch (error) {
    // Don't return Lexe internals or database exception messages to clients.
    console.error('Contact v2 invoice failed:', error?.message);
    return json(503, { ok: false, error: 'Could not issue postage invoice' });
  }
}
