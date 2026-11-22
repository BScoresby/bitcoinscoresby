// Run once on your own Ubuntu machine. Never add the resulting JSON to Git.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { toBase64Url } from '../contact-v2/envelope.mjs';

const dest = process.argv[2] || join(homedir(), '.config/bitcoinscoresby/contact-v2-x25519-key.json');
const pair = await crypto.subtle.generateKey('X25519', true, ['deriveBits']);
const recipient = toBase64Url(await crypto.subtle.exportKey('raw', pair.publicKey));
const pkcs8 = toBase64Url(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
await mkdir(dirname(dest), { recursive: true, mode: 0o700 });
try {
  await writeFile(dest, JSON.stringify({ format: 'bs-contact-v2-envelope-v1', recipient, private_key_pkcs8: pkcs8 }) + '\n', {
    flag: 'wx', mode: 0o600
  });
} catch (error) {
  if (error.code === 'EEXIST') throw Error(`Key file already exists: ${dest}. Refusing to overwrite it.`);
  throw error;
}
console.log(`Private key saved to: ${dest}`);
console.log(`PUBLIC KEY (safe for Cloudflare): ${recipient}`);
console.log('Back up the private key securely. Do NOT upload, paste, or commit it.');
