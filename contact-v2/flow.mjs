// Small, dependency-free helpers for a recoverable, payment-gated ciphertext.
import { validEnvelope } from './envelope.mjs';
export const STORAGE_KEY = 'bitcoinscoresby-contact-v2-pending-envelope-v1';
export const AMOUNT_MSAT = 21000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX64 = /^[0-9a-f]{64}$/;
const BOLT11 = /^lnbc[0-9a-z]{50,8192}$/i;

export function composeMessage(message, reply = '') {
  if (typeof message !== 'string' || message.length > 2000 || !message.trim()) {
    throw Error('Enter a message of up to 2,000 characters.');
  }
  if (typeof reply !== 'string' || reply.length > 200) {
    throw Error('Return address must be at most 200 characters.');
  }
  return reply.trim() ? `${message.trim()}\n\nReply address: ${reply.trim()}` : message.trim();
}

export function validateInvoiceResponse(data, expectedHash) {
  if (!data || data.ok !== true || !UUID.test(data.attempt_id) ||
      data.amount_msat !== AMOUNT_MSAT || !BOLT11.test(data.invoice) ||
      !HEX64.test(expectedHash) || data.envelope_hash !== expectedHash ||
      !Number.isSafeInteger(data.invoice_expires_at) || data.invoice_expires_at <= 0) {
    throw Error('Invoice service returned unexpected data. Do not pay this invoice.');
  }
  return data;
}
export function createSession(invoiceData, envelope, envelopeHash) {
  const invoice = validateInvoiceResponse(invoiceData, envelopeHash);
  if (!validEnvelope(envelope)) throw Error('Unable to preserve encrypted message. Do not pay.');
  return {
    version: 2, attempt_id: invoice.attempt_id,
    invoice: invoice.invoice, invoice_expires_at: invoice.invoice_expires_at,
    envelope, envelope_hash: envelopeHash,
    phase: 'invoiced', created_at_ms: Date.now()
  };
}
export function validSession(session) {
  return !!session && typeof session === 'object' && !Array.isArray(session) &&
    session.version === 2 && UUID.test(session.attempt_id) &&
    BOLT11.test(session.invoice) && HEX64.test(session.envelope_hash) &&
    Number.isSafeInteger(session.invoice_expires_at) &&
    Number.isSafeInteger(session.created_at_ms) &&
    ['invoiced', 'paid'].includes(session.phase) && validEnvelope(session.envelope) &&
    JSON.stringify(session).length <= 20000;
}
export function loadSession(store) {
  const raw = store.getItem(STORAGE_KEY);
  if (!raw) return null;
  if (raw.length > 20000) throw Error('Saved attempt is unexpectedly large. Do not pay again.');
  let value;
  try { value = JSON.parse(raw); } catch { throw Error('Saved payment attempt is corrupt. Do not pay again.'); }
  if (!validSession(value)) throw Error('Saved payment attempt is invalid. Do not pay again.');
  return value;
}
export function saveSession(store, value) {
  if (!validSession(value)) throw Error('Invalid payment recovery record. Do not pay.');
  store.setItem(STORAGE_KEY, JSON.stringify(value));
  const confirmed = loadSession(store);
  if (confirmed?.attempt_id !== value.attempt_id || confirmed.envelope_hash !== value.envelope_hash) {
    throw Error('Payment recovery could not be saved. Do not pay.');
  }
}
