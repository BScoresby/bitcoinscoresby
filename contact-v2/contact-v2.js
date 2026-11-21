import { giftWrap } from '/contact/nostr-crypto.js';
import { invoiceQR } from '/contact/qrcode.js';
import {
  RECIPIENT_HEX, STORAGE_KEY, composeMessage, createSession,
  loadSession, saveSession, validEvent
} from './flow.mjs';

const API = '/api/contact-v2';
const $ = selector => document.querySelector(selector);
const form = $('#contact-form');
const messageField = $('#message');
const replyField = $('#reply');
const messageShell = $('#terminal-message');
const replyShell = $('#terminal-reply-input');
const requestButton = $('#create-invoice');
const paymentArea = $('#payment-area');
const invoiceField = $('#invoice');
const qrArea = $('#invoice-qr');
const copyButton = $('#copy-invoice');
const checkButton = $('#check-payment');
const abandonButton = $('#abandon-attempt');
const statusEl = $('#status');
const successArea = $('#contact-success');
const acceptedId = $('#accepted-id');
const newMessageButton = $('#new-message');

let session = null;
let busy = false;
let timer = null;
let stopped = false;
let currentError = null;

function status(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle('error', isError);
}
function setBusy(value) {
  busy = value;
  requestButton.disabled = value;
  checkButton.disabled = value;
  abandonButton.disabled = value;
}
function stopTimer() {
  if (timer !== null) clearTimeout(timer);
  timer = null;
}
function schedule(delay) {
  stopTimer();
  if (stopped || !session || document.visibilityState === 'hidden') return;
  timer = setTimeout(() => { void checkPayment(); }, delay);
}
async function post(path, body, timeoutMs = 16000) {
  const response = await fetch(`${API}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    credentials: 'same-origin',
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify(body)
  });
  let data;
  try { data = await response.json(); }
  catch { throw Error(`Unexpected server response (HTTP ${response.status}).`); }
  if (!response.ok || !data?.ok) {
    const explanation = typeof data?.error === 'string' ? data.error : `HTTP ${response.status}`;
    const err = Error(explanation);
    err.status = response.status;
    throw err;
  }
  return data;
}
function ensureStorage() {
  const testKey = `${STORAGE_KEY}.probe`;
  try {
    localStorage.setItem(testKey, 'ok');
    if (localStorage.getItem(testKey) !== 'ok') throw Error();
    localStorage.removeItem(testKey);
  } catch {
    throw Error('Browser storage is unavailable. We cannot safely preserve a paid submission. No invoice was requested.');
  }
}
function renderDraft() {
  form.hidden = false;
  paymentArea.hidden = true;
  successArea.hidden = true;
  qrArea.replaceChildren();
  invoiceField.value = '';
  messageField.readOnly = false;
  replyField.readOnly = false;
  messageShell.classList.toggle('has-text', !!messageField.value);
  replyShell.classList.toggle('has-text', !!replyField.value);
}
function renderPayment() {
  form.hidden = true;
  paymentArea.hidden = false;
  successArea.hidden = true;
  invoiceField.value = session.invoice;
  qrArea.replaceChildren();
  try { qrArea.replaceChildren(invoiceQR(session.invoice)); }
  catch { status('Invoice QR unavailable; use Copy invoice.'); }
  // Abandonment is offered only after Lexe explicitly reports an expired,
  // unsettled invoice. Never offer a normal way to discard a paid attempt.
  abandonButton.hidden = true;
}
function accepted(eventId, seq) {
  stopTimer();
  session = null;
  try { localStorage.removeItem(STORAGE_KEY); }
  catch { /* A stale encrypted record can be retried safely next time. */ }
  form.hidden = true;
  paymentArea.hidden = true;
  successArea.hidden = false;
  acceptedId.textContent = `Encrypted event: ${eventId}${Number.isSafeInteger(seq) ? ` · Inbox sequence: ${seq}` : ''}`;
  status('');
}

async function requestPostage(event) {
  event.preventDefault();
  if (busy || session || stopped) return;
  setBusy(true);
  try {
    ensureStorage();
    const plaintext = composeMessage(messageField.value, replyField.value);
    status('Encrypting your message locally…');
    // Creating ciphertext BEFORE requesting an invoice makes reload recovery
    // possible without storing plaintext. Nothing is uploaded here.
    const encryptedEvent = await giftWrap(plaintext, RECIPIENT_HEX);
    if (!validEvent(encryptedEvent)) throw Error('Encryption output failed validation. No invoice was requested.');
    status('Requesting a 21-sat invoice from Lexe…');
    const invoice = await post('invoice', {}, 25000);
    const record = createSession(invoice, encryptedEvent);
    saveSession(localStorage, record);
    session = record;
    // Clear plaintext input once the encrypted recovery record is durable.
    messageField.value = '';
    replyField.value = '';
    renderPayment();
    status('Invoice ready. Pay 21 sats. We will check for settlement automatically.');
    schedule(3000);
  } catch (error) {
    // If the invoice was issued but recovery failed, don't display it.
    status(`Could not prepare postage: ${error.message}. No payment is required.`, true);
  } finally { setBusy(false); }
}

async function submitEncrypted() {
  if (!session) return;
  status('Payment verified. Submitting the encrypted message…');
  // Exact same event and attempt ID across *all* retries.
  const attemptId = session.attempt_id;
  const savedEvent = session.event;
  try {
    const result = await post('accept', { attempt_id: attemptId, event: savedEvent }, 18000);
    if (result.state !== 'accepted' || result.event_id !== savedEvent.id) {
      throw Error('Server returned a mismatched acceptance record.');
    }
    accepted(savedEvent.id, result.seq);
  } catch (error) {
    if (!session) return;
    if (error.status === 409 || error.status === 400 || error.status === 413) {
      stopped = true;
      status(`Payment verified, but the message was NOT accepted: ${error.message}. Do not pay again; retain this browser's encrypted record for investigation.`, true);
      return;
    }
    status(`Payment verified, but storage is not yet confirmed: ${error.message}. Retrying the SAME encrypted event. Do not pay again.`, true);
    schedule(12000);
  }
}

async function checkPayment() {
  if (busy || !session || stopped) return;
  stopTimer();
  setBusy(true);
  try {
    status(session.phase === 'paid' ? 'Checking message delivery…' : 'Checking payment with Lexe…');
    // Even after the browser has observed payment, verify server state again.
    // Server can independently recognize 'accepted' from a prior request.
    const result = await post('verify', { attempt_id: session.attempt_id }, 16000);
    if (result.settled === true && ['paid', 'accepted'].includes(result.state)) {
      abandonButton.hidden = true;
      if (session.phase !== 'paid') {
        session.phase = 'paid';
        try { saveSession(localStorage, session); }
        catch { /* Keep the in-memory event, warn via next error if necessary. */ }
      }
      await submitEncrypted();
    } else if (result.settled === false && result.state === 'invoiced') {
      if (result.expired === true) {
        abandonButton.hidden = false;
        status('This invoice has expired and Lexe currently reports it as unpaid. Do not pay it now. You can check again or explicitly abandon this attempt.', true);
      } else {
        abandonButton.hidden = true;
        status('Awaiting the 21-sat payment. This page checks automatically while visible.');
        schedule(6000);
      }
    } else {
      throw Error('Unexpected payment state. Keep the payment attempt and do not pay twice.');
    }
  } catch (error) {
    status(`Status check unavailable: ${error.message}. Your encrypted attempt is saved; do not pay again.`, true);
    schedule(15000);
  } finally { setBusy(false); }
}

form.addEventListener('submit', event => { void requestPostage(event); });
messageField.addEventListener('input', () => messageShell.classList.toggle('has-text', !!messageField.value));
replyField.addEventListener('input', () => replyShell.classList.toggle('has-text', !!replyField.value));
checkButton.addEventListener('click', () => { stopped = false; void checkPayment(); });
copyButton.addEventListener('click', async () => {
  if (!session) return;
  try { await navigator.clipboard.writeText(session.invoice); status('Invoice copied.'); }
  catch { invoiceField.focus(); invoiceField.select(); status('Invoice selected. Copy it manually.'); }
});
abandonButton.addEventListener('click', () => {
  if (busy || !session) return;
  const warning = 'Abandon this invoice and its encrypted draft? If it was paid, or later settles, recovery may become impossible. This action cannot be undone. Continue ONLY if you are certain it was not paid.';
  if (!window.confirm(warning)) return;
  try { localStorage.removeItem(STORAGE_KEY); }
  catch { status('Could not clear the saved payment. Do not start another attempt yet.', true); return; }
  session = null;
  stopped = false;
  stopTimer();
  renderDraft();
  status('Attempt abandoned. Write a new message before requesting another invoice.');
});
newMessageButton.addEventListener('click', () => {
  stopped = false;
  renderDraft();
  status('');
  messageField.focus();
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') stopTimer();
  else if (session && !busy && !stopped) schedule(300);
});
window.addEventListener('online', () => { if (session && !busy && !stopped) schedule(300); });
window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY || !session) return;
  // Another tab or script changed the recovery record. Avoid replacing an
  // immutable event or pretending the local browser owns the payment.
  stopTimer();
  stopped = true;
  status('This payment record changed in another tab. Reload to reconcile before continuing. Do not pay again.', true);
});

try {
  session = loadSession(localStorage);
  if (session) {
    renderPayment();
    status('Recovered your encrypted draft and original invoice. Checking payment status…');
    schedule(200);
  } else {
    renderDraft();
  }
} catch (error) {
  stopped = true;
  requestButton.disabled = true;
  status(`${error.message} Recovery is paused; preserve browser storage and investigate before making another payment.`, true);
}
