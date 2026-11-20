import { decodeBolt11 } from '../../../lib/contact-v2/bolt11.js';

const AMOUNT_MSAT = 21000;
const NO_STORE = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };
const json = (status, data) => Response.json(data, { status, headers: NO_STORE });
const validUsername = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(value);

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

export async function onRequestPost({ request, env }) {
  // Development safeguard: this first endpoint is only enabled deliberately.
  if (env.CONTACT_V2_INVOICE_ENABLED !== 'true') {
    return json(404, { ok: false, error: 'Endpoint disabled' });
  }
  if (!env.CONTACT_DB || !validUsername(env.LEXE_USERNAME)) {
    return json(503, { ok: false, error: 'Payment service not configured' });
  }
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return json(403, { ok: false, error: 'Cross-origin request rejected' });
  }
  if (Number(request.headers.get('content-length') || 0) > 1024) {
    return json(413, { ok: false, error: 'Request too large' });
  }
  const now = Math.floor(Date.now() / 1000);
  try {
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
        (id, state, invoice, payment_hash, verify_url, amount_msat, created_at, invoice_expires_at)
      VALUES (?, 'invoiced', ?, ?, ?, ?, ?, ?)
    `).bind(attemptId, invoice, parsed.payment_hash,
      verify.toString(), AMOUNT_MSAT, now, parsed.invoice_expires_at).run();
    return json(201, { ok: true, attempt_id: attemptId,
      invoice, amount_msat: AMOUNT_MSAT,
      invoice_expires_at: parsed.invoice_expires_at });
  } catch (error) {
    // Don't return Lexe internals or database exception messages to clients.
    console.error('Contact v2 invoice failed:', error?.message);
    return json(503, { ok: false, error: 'Could not issue postage invoice' });
  }
}
