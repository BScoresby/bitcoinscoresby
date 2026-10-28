import { validateZapReceipt } from './verify-crypto.js';

const headers = { 'Cache-Control': 'no-store' };
const fail = (status, error) => Response.json({ ok: false, error }, { status, headers });

// Receipt is supplied as untrusted data. The server independently validates
// signatures, the invoice description commitment and the D1 attempt binding.
export async function onRequestPost({ request, env }) {
  if (!env.CONTACT_DB) return fail(503, 'Database unavailable');
  if (Number(request.headers.get('content-length') || 0) > 25000) return fail(413, 'Request too large');
  let input;
  try {
    const raw = await request.text();
    if (raw.length > 25000) return fail(413, 'Request too large');
    input = JSON.parse(raw);
  } catch { return fail(400, 'Invalid JSON'); }

  const id = input?.attempt_id;
  const receipt = input?.receipt;
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return fail(400, 'Invalid attempt ID');
  }
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) return fail(400, 'Invalid receipt');

  let row;
  try {
    row = await env.CONTACT_DB.prepare(`
      SELECT id, nonce, state, invoice, zap_request_id, receipt_id,
             created_at, expires_at
      FROM contact_attempts WHERE id = ?
    `).bind(id).first();
  } catch (error) {
    console.error('Contact verify D1 read:', error);
    return fail(503, 'Database unavailable');
  }
  if (!row) return fail(404, 'Unknown attempt');
  if (row.state !== 'invoiced') return fail(409, 'Attempt not available for verification');

  let valid;
  try { valid = await validateZapReceipt(receipt, row); }
  catch (error) {
    console.warn('Contact receipt rejected:', error?.message);
    return fail(400, 'Receipt did not pass verification');
  }

  try {
    // Atomic transition: only one request can claim this invoice and receipt.
    // UNIQUE(receipt_id) also blocks reuse across different attempts.
    const result = await env.CONTACT_DB.prepare(`
      UPDATE contact_attempts SET state = 'paid', receipt_id = ?
      WHERE id = ? AND state = 'invoiced' AND receipt_id IS NULL
        AND zap_request_id = ? AND invoice = ?
    `).bind(valid.receipt_id, id, valid.request_id, row.invoice).run();
    if (result.meta?.changes !== 1) return fail(409, 'Attempt already used or changed');
  } catch (error) {
    console.error('Contact verify D1 update:', error);
    return fail(409, 'Receipt already used or database update failed');
  }
  return Response.json({ ok: true, state: 'paid', receipt_id: valid.receipt_id }, { headers });
}
