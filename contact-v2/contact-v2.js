import { encryptEnvelope, hashEnvelope, validRecipient } from './envelope.mjs';
import {
  STORAGE_KEY, composeMessage, createSession,
  loadSession, saveSession
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
const invoiceDetails = $('#invoice-details');
const qrArea = $('#invoice-qr');
const copyButton = $('#copy-invoice');
const abandonButton = $('#abandon-attempt');
const statusEl = $('#status');
const successArea = $('#contact-success');
const newMessageButton = $('#new-message');

let session = null;
let busy = false;
let timer = null;
let stopped = false;

function status(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle('error', isError);
}
function setBusy(value) {
  busy = value;
  requestButton.disabled = value;
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
    err.retryAfter = Number(data?.retry_after || response.headers.get('Retry-After')) || 30;
    throw err;
  }
  return data;
}
async function loadRecipientKey() {
  const response = await fetch(`${API}/invoice`, {cache:'no-store',credentials:'same-origin'});
  if (!response.ok) throw Error('Recipient encryption key unavailable. No invoice was requested.');
  const config = await response.json();
  if (config?.ok !== true || config.version !== 1 || !validRecipient(config.recipient_public_key)) {
    throw Error('Invalid recipient encryption key. No invoice was requested.');
  }
  return config.recipient_public_key;
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
  copyButton.textContent = 'Copy';
  invoiceDetails.open = false;
  qrArea.replaceChildren();
  // The QR module is only needed once an invoice exists. Guard its asynchronous
  // result so an abandoned invoice cannot redraw itself on the compose screen.
  const attemptId = session.attempt_id;
  void import('/contact/qrcode.js').then(({ invoiceQR }) => {
    if (!session || session.attempt_id !== attemptId || paymentArea.hidden) return;
    qrArea.replaceChildren(invoiceQR(session.invoice));
  }).catch(() => {
    if (session?.attempt_id === attemptId) status('QR unavailable. Use Copy.', true);
  });
  // Allow an explicitly unpaid attempt to be discarded at any time, including
  // during verification cooldown. Never discard a confirmed paid attempt.
  abandonButton.hidden = session.phase === 'paid';
}
function accepted() {
  stopTimer();
  session = null;
  try { localStorage.removeItem(STORAGE_KEY); }
  catch { /* A stale encrypted record can be retried safely next time. */ }
  form.hidden = true;
  paymentArea.hidden = true;
  successArea.hidden = false;
  status('');
}

async function requestPostage(event) {
  event.preventDefault();
  if (busy || session || stopped) return;
  setBusy(true);
  try {
    ensureStorage();
    const plaintext = composeMessage(messageField.value, replyField.value);
    status('');
    // Creating ciphertext BEFORE requesting an invoice makes reload recovery
    // possible without storing plaintext. Nothing is uploaded here.
    const recipientKey = await loadRecipientKey();
    const envelope = await encryptEnvelope(plaintext, recipientKey);
    const envelopeHash = await hashEnvelope(envelope);
    const invoice = await post('invoice', {envelope_hash:envelopeHash}, 25000);
    const record = createSession(invoice, envelope, envelopeHash);
    saveSession(localStorage, record);
    session = record;
    // Clear plaintext input once the encrypted recovery record is durable.
    messageField.value = '';
    replyField.value = '';
    renderPayment();
    status('');
    schedule(4000);
  } catch (error) {
    // If the invoice was issued but recovery failed, don't display it.
    status(`Could not prepare postage: ${error.message}. No payment is required.`, true);
  } finally { setBusy(false); }
}

async function submitEncrypted() {
  if (!session) return;
  status('');
  // Exact same event and attempt ID across *all* retries.
  const attemptId = session.attempt_id;
  const savedEnvelope = session.envelope;
  try {
    const result = await post('accept', { attempt_id: attemptId, envelope: savedEnvelope }, 18000);
    if (result.state !== 'accepted' || result.message_id !== session.envelope_hash) {
      throw Error('Server returned a mismatched acceptance record.');
    }
    accepted();
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
    status('');
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
        status('Invoice expired. Select Cancel to start over.', true);
      } else {
        abandonButton.hidden = false;
        status('');
        schedule(32000);
      }
    } else {
      throw Error('Unexpected payment state. Keep the payment attempt and do not pay twice.');
    }
  } catch (error) {
    if (error.status === 410) {
      stopped = true;
      status('This invoice is too old to verify automatically. If you believe you paid it, preserve your saved record and contact the site operator. Do not pay it again.', true);
    } else if (error.status === 429) {
      status('');
      schedule(Math.max(1000, error.retryAfter * 1000 + 1000));
    } else {
      status(`Status check unavailable: ${error.message}. Your encrypted attempt is saved; do not pay again.`, true);
      schedule(30000);
    }
  } finally { setBusy(false); }
}

form.addEventListener('submit', event => { void requestPostage(event); });
messageField.addEventListener('input', () => messageShell.classList.toggle('has-text', !!messageField.value));
replyField.addEventListener('input', () => replyShell.classList.toggle('has-text', !!replyField.value));
copyButton.addEventListener('click', async () => {
  if (!session) return;
  try {
    await navigator.clipboard.writeText(session.invoice);
    copyButton.textContent = 'Copied';
    setTimeout(() => { copyButton.textContent = 'Copy'; }, 1500);
  }
  catch { invoiceField.focus(); invoiceField.select(); status('Invoice selected. Copy it manually.'); }
});
abandonButton.addEventListener('click', () => {
  if (busy || !session || session.phase !== 'invoiced') return;
  // No server-side cancellation: it could race with a genuine settlement.
  // Forget only the local unpaid attempt and stop future browser polling.
  try {
    localStorage.removeItem(STORAGE_KEY);
    if (localStorage.getItem(STORAGE_KEY) !== null) throw Error('Storage did not clear');
  } catch {
    status('Could not clear the saved payment. Do not start another attempt yet.', true);
    return;
  }
  stopTimer();
  session = null;
  stopped = false;
  renderDraft();
  status('');
  messageField.focus();
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
    // Recheck the local ciphertext/commitment before attempting to redeem payment.
    void hashEnvelope(session.envelope).then(actual => {
      if (actual !== session.envelope_hash) throw Error('Saved encrypted message differs from its invoice commitment.');
      renderPayment();
      status('');
      schedule(300);
    }).catch(error => {
      stopped = true; requestButton.disabled = true;
      status(`${error.message} Preserve browser storage and investigate before making another payment.`,true);
    });
  } else {
    renderDraft();
  }
} catch (error) {
  stopped = true;
  requestButton.disabled = true;
  status(`${error.message} Recovery is paused; preserve browser storage and investigate before making another payment.`, true);
}
