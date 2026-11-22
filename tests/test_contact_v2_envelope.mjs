import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toBase64Url, fromBase64Url, validRecipient, validEnvelope,
  canonicalEnvelope, encryptEnvelope, decryptEnvelope, hashEnvelope
} from '../contact-v2/envelope.mjs';

async function keys() {
  const pair = await crypto.subtle.generateKey('X25519', true, ['deriveBits']);
  const recipient = toBase64Url(await crypto.subtle.exportKey('raw', pair.publicKey));
  return { privateKey: pair.privateKey, recipient };
}

test('recipient key and base64url are canonical', async () => {
  const { recipient } = await keys();
  assert.ok(validRecipient(recipient));
  assert.equal(fromBase64Url(recipient).length, 32);
  assert.equal(toBase64Url(fromBase64Url(recipient)), recipient);
  assert.equal(validRecipient('a'.repeat(43)), false); // malformed final pad bits
});

test('browser-native encryption round trips UTF-8 text', async () => {
  const { recipient, privateKey } = await keys();
  const message = 'Hello, 21 sats! ☕ — 私的なメッセージ';
  const envelope = await encryptEnvelope(message, recipient);
  assert.ok(validEnvelope(envelope));
  assert.equal(await decryptEnvelope(envelope, privateKey), message);
  assert.equal((await hashEnvelope(envelope)).length, 64);
});

test('hash commits to canonical ciphertext, not object insertion order', async () => {
  const { recipient } = await keys();
  const envelope = await encryptEnvelope('test', recipient);
  const reordered = Object.fromEntries(Object.entries(envelope).reverse());
  assert.equal(canonicalEnvelope(reordered), canonicalEnvelope(envelope));
  assert.equal(await hashEnvelope(reordered), await hashEnvelope(envelope));
  assert.equal(validEnvelope({ ...envelope, extra: 'x' }), false);
});

test('modified ciphertext and recipient are rejected', async () => {
  const { recipient, privateKey } = await keys();
  const other = await keys();
  const envelope = await encryptEnvelope('secret', recipient);
  const altered = { ...envelope, ct: (envelope.ct[0] === 'A' ? 'B' : 'A') + envelope.ct.slice(1) };
  assert.ok(validEnvelope(altered));
  await assert.rejects(() => decryptEnvelope(altered, privateKey));
  await assert.rejects(() => decryptEnvelope(envelope, other.privateKey));
  assert.notEqual(await hashEnvelope(altered), await hashEnvelope(envelope));
});

test('new ephemeral key and salt per message', async () => {
  const { recipient } = await keys();
  const a = await encryptEnvelope('repeat', recipient);
  const b = await encryptEnvelope('repeat', recipient);
  assert.notEqual(a.epk, b.epk);
  assert.notEqual(a.salt, b.salt);
  assert.notEqual(a.ct, b.ct);
});

test('rejects large/empty messages before payment', async () => {
  const { recipient } = await keys();
  await assert.rejects(() => encryptEnvelope('', recipient));
  await assert.rejects(() => encryptEnvelope('🙂'.repeat(2049), recipient));
  const envelope = await encryptEnvelope('🙂'.repeat(2000), recipient);
  assert.ok(validEnvelope(envelope));
});
