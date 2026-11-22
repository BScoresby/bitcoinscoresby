// BitcoinScoresby Contact v2: dependency-free, versioned E2E envelope.
// Uses the browser/Node Web Crypto implementation of X25519, HKDF and AES-GCM.
// This file handles encryption only. The server never receives a private key.
const text = new TextEncoder();
const FORMAT = 'bitcoinscoresby/contact-v2/X25519+HKDF-SHA256+AES-256-GCM/v1';
const PUB = /^[A-Za-z0-9_-]{43}$/;
const SALT = /^[A-Za-z0-9_-]{22}$/;
const NONCE = /^[A-Za-z0-9_-]{16}$/;
const CIPHERTEXT = /^[A-Za-z0-9_-]{24,11000}$/;
const MAX_PLAINTEXT_BYTES = 8192;

export function toBase64Url(data) {
  let binary = '';
  for (const byte of new Uint8Array(data)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
export function fromBase64Url(encoded) {
  if (typeof encoded !== 'string' || !/^[A-Za-z0-9_-]+$/.test(encoded)) {
    throw Error('Invalid base64url value');
  }
  const binary = atob(encoded.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - encoded.length % 4) % 4));
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  if (toBase64Url(bytes) !== encoded) throw Error('Noncanonical base64url value');
  return bytes;
}
function concat(...parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}
export function validRecipient(key) {
  if (!PUB.test(key)) return false;
  try { return fromBase64Url(key).length === 32; } catch { return false; }
}

export function validEnvelope(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).sort().join(',') !== 'ct,epk,nonce,recipient,salt,v' ||
      value.v !== 1 || !validRecipient(value.recipient) ||
      !PUB.test(value.epk) || !SALT.test(value.salt) ||
      !NONCE.test(value.nonce) || !CIPHERTEXT.test(value.ct)) return false;
  try {
    return fromBase64Url(value.epk).length === 32 &&
      fromBase64Url(value.salt).length === 16 &&
      fromBase64Url(value.nonce).length === 12 &&
      fromBase64Url(value.ct).length >= 17 &&
      fromBase64Url(value.ct).length <= MAX_PLAINTEXT_BYTES + 16;
  } catch { return false; }
}

export function canonicalEnvelope(value) {
  if (!validEnvelope(value)) throw Error('Invalid encrypted envelope');
  // Deterministic bytes make the invoice commitment and retry identity stable.
  return JSON.stringify({
    v: value.v, recipient: value.recipient, epk: value.epk,
    salt: value.salt, nonce: value.nonce, ct: value.ct
  });
}

export async function hashEnvelope(value) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', text.encode(canonicalEnvelope(value))));
  return Array.from(bytes, n => n.toString(16).padStart(2, '0')).join('');
}

async function deriveAesKey(privateKey, publicKey, salt, epk, recipient, usage) {
  const secret = await crypto.subtle.deriveBits({ name: 'X25519', public: publicKey }, privateKey, 256);
  const material = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']);
  // Bind both public keys and the protocol version to the key and ciphertext.
  const context = concat(text.encode(FORMAT), epk, recipient);
  const key = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: context },
    material, { name: 'AES-GCM', length: 256 }, false, [usage]
  );
  return { key, context };
}

export async function encryptEnvelope(plaintext, recipientBase64Url) {
  if (!validRecipient(recipientBase64Url)) throw Error('Invalid recipient encryption key');
  if (typeof plaintext !== 'string') throw Error('Message must be text');
  const bytes = text.encode(plaintext);
  if (bytes.length < 1 || bytes.length > MAX_PLAINTEXT_BYTES) {
    throw Error('Message is too long or empty; no invoice was requested.');
  }
  const recipientBytes = fromBase64Url(recipientBase64Url);
  const recipientKey = await crypto.subtle.importKey('raw', recipientBytes, 'X25519', false, []);
  const ephemeral = await crypto.subtle.generateKey('X25519', true, ['deriveBits']);
  const epkBytes = new Uint8Array(await crypto.subtle.exportKey('raw', ephemeral.publicKey));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const { key, context } = await deriveAesKey(ephemeral.privateKey, recipientKey, salt, epkBytes, recipientBytes, 'encrypt');
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, additionalData: context, tagLength: 128 }, key, bytes);
  return {
    v: 1,
    recipient: recipientBase64Url,
    epk: toBase64Url(epkBytes),
    salt: toBase64Url(salt),
    nonce: toBase64Url(nonce),
    ct: toBase64Url(ciphertext)
  };
}

// Intended for local inbox tooling only. Do NOT ship the private key to Cloudflare.
export async function decryptEnvelope(envelope, recipientPrivateKey) {
  if (!validEnvelope(envelope)) throw Error('Invalid encrypted envelope');
  const epk = fromBase64Url(envelope.epk);
  const recipient = fromBase64Url(envelope.recipient);
  const publicKey = await crypto.subtle.importKey('raw', epk, 'X25519', false, []);
  const { key, context } = await deriveAesKey(
    recipientPrivateKey, publicKey, fromBase64Url(envelope.salt), epk, recipient, 'decrypt'
  );
  const bytes = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64Url(envelope.nonce), additionalData: context, tagLength: 128 },
    key, fromBase64Url(envelope.ct)
  );
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
