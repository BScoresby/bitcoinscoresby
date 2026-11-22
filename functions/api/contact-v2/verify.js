// BitcoinScoresby Contact v2 — confirm a Lexe LUD-21 invoice settlement.
// No ciphertext is accepted, published or stored by this endpoint.
// Uses only a server-stored invoice and verification URL.

const AMOUNT_MSAT = 21000;
const MAX_REQUEST_BYTES = 1024;
const MAX_RESPONSE_BYTES = 8192;
const VERIFY_COOLDOWN_SECONDS = 30;
const MAX_UNVERIFIED_RECOVERY_SECONDS = 4 * 86400;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX32_PATTERN = /^[a-fA-F0-9]{64}$/;
const NO_STORE = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff'
};
const json = (status, value) => Response.json(value, { status, headers: NO_STORE });

function validateVerifyUrl(input) {
  let url;
  try { url = new URL(input); } catch { throw Error('Invalid stored verify URL'); }
  if (url.protocol !== 'https:' || url.hostname !== 'lexe.app' ||
      url.username || url.password || url.port || url.search || url.hash ||
      !/^\/public\/v1\/lnurl_verify\/[A-Za-z0-9_-]+$/.test(url.pathname)) {
    throw Error('Unexpected stored verify URL');
  }
  return url.toString();
}

async function readSmallJsonBody(request) {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw Error('JSON content-type required');
  }
  const length = request.headers.get('content-length');
  if (length !== null && Number(length) > MAX_REQUEST_BYTES) throw Error('Request too large');
  if (!request.body) throw Error('Request body required');
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_REQUEST_BYTES) {
        await reader.cancel().catch(() => {});
        throw Error('Request too large');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const part of chunks) { bytes.set(part, offset); offset += part.length; }
  const obj = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) throw Error('Expected JSON object');
  return obj;
}

async function fetchLexeVerification(url) {
  const response = await fetch(url, {
    method: 'GET', redirect: 'manual',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok || response.status >= 300 || !response.body) throw Error('Lexe verify request failed');
  // Guard actual received bytes; Content-Length alone is insufficient.
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel().catch(() => {});
        throw Error('Lexe response too large');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const part of chunks) { bytes.set(part, offset); offset += part.length; }
  const obj = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw Error('Invalid Lexe response');
  return obj;
}

function bytesFromHex(hex) {
  if (!HEX32_PATTERN.test(hex)) throw Error('Invalid 32-byte hexadecimal value');
  return Uint8Array.from(hex.match(/../g), item => Number.parseInt(item, 16));
}

async function preimageMatchesHash(preimage, paymentHash) {
  if (typeof preimage !== 'string' || typeof paymentHash !== 'string' ||
      !HEX32_PATTERN.test(preimage) || !HEX32_PATTERN.test(paymentHash)) return false;
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytesFromHex(preimage)));
  const expected = bytesFromHex(paymentHash);
  let difference = 0;
  for (let i = 0; i < 32; i++) difference |= digest[i] ^ expected[i];
  return difference === 0;
}

async function loadAttempt(db, id) {
  return db.prepare(`
    SELECT id, state, invoice, payment_hash, verify_url,
           amount_msat, invoice_expires_at, paid_at, next_verify_at
    FROM contact_v2_attempts WHERE id = ?
  `).bind(id).first();
}

export async function onRequestPost({ request, env }) {
  if (env.CONTACT_V2_VERIFY_ENABLED !== 'true') {
    return json(404, { ok: false, error: 'Endpoint disabled' });
  }
  if (!env.CONTACT_DB) return json(503, { ok: false, error: 'Payment service not configured' });
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return json(403, { ok: false, error: 'Cross-origin request rejected' });
  }
  let input;
  try { input = await readSmallJsonBody(request); }
  catch { return json(400, { ok: false, error: 'Invalid request body' }); }
  const { attempt_id: id } = input;
  if (typeof id !== 'string' || !UUID_PATTERN.test(id)) {
    return json(400, { ok: false, error: 'Invalid attempt ID' });
  }

  try {
    const attempt = await loadAttempt(env.CONTACT_DB, id);
    if (!attempt) return json(404, { ok: false, error: 'Unknown payment attempt' });
    if (attempt.state === 'paid' || attempt.state === 'accepted') {
      return json(200, { ok: true, settled: true, state: attempt.state });
    }
    // One invoice ID must not be able to trigger Lexe traffic forever.
    // Old 'paid' and 'accepted' attempts above are still idempotently readable.
    if (Math.floor(Date.now()/1000) > attempt.invoice_expires_at + MAX_UNVERIFIED_RECOVERY_SECONDS) {
      return json(410, {ok:false,error:'Unverified invoice recovery window has ended'});
    }
    if (attempt.state !== 'invoiced' || attempt.paid_at !== null ||
        attempt.amount_msat !== AMOUNT_MSAT ||
        typeof attempt.invoice !== 'string' || attempt.invoice.length > 8192 ||
        !HEX32_PATTERN.test(attempt.payment_hash)) {
      throw Error('Inconsistent attempt record');
    }
    // Atomic per-attempt lease. Multiple browsers/IPs cannot cause multiple
    // simultaneous or rapid external Lexe calls for the same unpaid invoice.
    const now = Math.floor(Date.now() / 1000);
    const lease = await env.CONTACT_DB.prepare(`
      UPDATE contact_v2_attempts SET next_verify_at = ?
      WHERE id = ? AND state = 'invoiced' AND next_verify_at <= ?
      RETURNING id
    `).bind(now + VERIFY_COOLDOWN_SECONDS, id, now).first();
    if (!lease) {
      const latest = await loadAttempt(env.CONTACT_DB, id);
      if (latest?.state === 'paid' || latest?.state === 'accepted') {
        return json(200, { ok: true, settled: true, state: latest.state });
      }
      const remaining = Math.max(1, Math.min(VERIFY_COOLDOWN_SECONDS, (latest?.next_verify_at || now + VERIFY_COOLDOWN_SECONDS) - now));
      return Response.json({ok:false,error:'Payment verification cooling down',retry_after:remaining},
        {status:429,headers:{...NO_STORE,'Retry-After':String(remaining)}});
    }
    const verifyUrl = validateVerifyUrl(attempt.verify_url);
    const result = await fetchLexeVerification(verifyUrl);
    if (result.status !== 'OK' || typeof result.settled !== 'boolean' ||
        typeof result.pr !== 'string' || result.pr !== attempt.invoice) {
      throw Error('Unexpected Lexe verification response');
    }
    if (result.settled === false) {
      const expired = Math.floor(Date.now() / 1000) > attempt.invoice_expires_at;
      return json(200, { ok: true, settled: false, state: 'invoiced', expired });
    }
    if (!(await preimageMatchesHash(result.preimage, attempt.payment_hash))) {
      throw Error('Lexe preimage does not match invoice payment hash');
    }

    const settledAt = Math.floor(Date.now() / 1000);
    const write = await env.CONTACT_DB.prepare(`
      UPDATE contact_v2_attempts SET state = 'paid', paid_at = ?
      WHERE id = ? AND state = 'invoiced' AND paid_at IS NULL
        AND amount_msat = ? AND invoice = ? AND payment_hash = ?
    `).bind(settledAt, id, AMOUNT_MSAT, attempt.invoice, attempt.payment_hash).run();
    if (write?.meta?.changes === 1) {
      return json(200, { ok: true, settled: true, state: 'paid' });
    }
    // Another concurrent request may have verified it first.
    const latest = await loadAttempt(env.CONTACT_DB, id);
    if (latest?.paid_at !== null && (latest?.state === 'paid' || latest?.state === 'accepted')) {
      return json(200, { ok: true, settled: true, state: latest.state });
    }
    throw Error('Payment state transition failed');
  } catch (error) {
    // Do not log invoice, preimage or verification URL, or expose Lexe details.
    console.error('Contact v2 verify failed:', error?.message);
    return json(502, { ok: false, error: 'Unable to verify payment right now' });
  }
}
