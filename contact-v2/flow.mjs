// Pure validation and session helpers, deliberately dependency-free.
// The receiving public key is public; it MUST match Preview CONTACT_INBOX_PUBKEY.
export const RECIPIENT_HEX = '0aa03f87ef253bc362ee071c3934ba9165c423bd39dafc0b302ce472eb6719a8';
export const STORAGE_KEY = 'bitcoinscoresby-contact-v2-pending-v1';
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
  const trimmedMessage = message.trim();
  const trimmedReply = reply.trim();
  return trimmedReply ? `${trimmedMessage}\n\nReply address: ${trimmedReply}` : trimmedMessage;
}

export function validEvent(event) {
  return !!event && typeof event === 'object' && !Array.isArray(event) &&
    event.kind === 1059 && HEX64.test(event.id) && HEX64.test(event.pubkey) &&
    typeof event.sig === 'string' && /^[0-9a-f]{128}$/.test(event.sig) &&
    Number.isSafeInteger(event.created_at) &&
    Array.isArray(event.tags) && event.tags.length === 1 &&
    Array.isArray(event.tags[0]) && event.tags[0].length === 2 &&
    event.tags[0][0] === 'p' && event.tags[0][1] === RECIPIENT_HEX &&
    typeof event.content === 'string' && event.content.length > 0 && event.content.length <= 10000;
}

export function validateInvoiceResponse(data) {
  if (!data || data.ok !== true || !UUID.test(data.attempt_id) ||
      data.amount_msat !== AMOUNT_MSAT || !BOLT11.test(data.invoice) ||
      !Number.isSafeInteger(data.invoice_expires_at) || data.invoice_expires_at <= 0) {
    throw Error('Invoice service returned unexpected data. Do not pay this invoice.');
  }
  return data;
}

export function createSession(invoiceData, event) {
  const invoice = validateInvoiceResponse(invoiceData);
  if (!validEvent(event)) throw Error('Unable to preserve encrypted message. Do not pay.');
  return {
    version: 1,
    attempt_id: invoice.attempt_id,
    invoice: invoice.invoice,
    invoice_expires_at: invoice.invoice_expires_at,
    event,
    phase: 'invoiced',
    created_at_ms: Date.now()
  };
}

export function validSession(session) {
  if (!session || typeof session !== 'object' || Array.isArray(session) ||
      session.version !== 1 || !UUID.test(session.attempt_id) ||
      !BOLT11.test(session.invoice) ||
      !Number.isSafeInteger(session.invoice_expires_at) ||
      !Number.isSafeInteger(session.created_at_ms) ||
      !['invoiced', 'paid'].includes(session.phase) || !validEvent(session.event)) return false;
  // Bound saved session's size and age; don't silently erase older records.
  return JSON.stringify(session).length <= 32000;
}

export function loadSession(store) {
  const raw = store.getItem(STORAGE_KEY);
  if (!raw) return null;
  if (raw.length > 32000) throw Error('Saved attempt is unexpectedly large. Do not pay again.');
  let value;
  try { value = JSON.parse(raw); } catch { throw Error('Saved payment attempt is corrupt. Do not pay again.'); }
  if (!validSession(value)) throw Error('Saved payment attempt is invalid. Do not pay again.');
  return value;
}

export function saveSession(store, value) {
  if (!validSession(value)) throw Error('Invalid payment recovery record. Do not pay.');
  store.setItem(STORAGE_KEY, JSON.stringify(value));
  // Verify persistence before presenting an invoice; a storage failure must
  // never leave a paid visitor thinking they have recovery when they do not.
  const confirmed = loadSession(store);
  if (confirmed?.attempt_id !== value.attempt_id || confirmed.event.id !== value.event.id) {
    throw Error('Payment recovery could not be saved. Do not pay.');
  }
}
