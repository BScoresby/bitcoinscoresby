// Local, offline decrypt utility. Usage: node scripts/contact_v2_decrypt.mjs KEY_FILE ENVELOPE_JSON
import { readFile } from 'node:fs/promises';
import { decryptEnvelope, fromBase64Url, toBase64Url } from '../contact-v2/envelope.mjs';

if (process.argv.length !== 4) {
  console.error('Usage: node scripts/contact_v2_decrypt.mjs KEY_FILE ENVELOPE_JSON');
  process.exit(2);
}
const keyfile = JSON.parse(await readFile(process.argv[2], 'utf8'));
if (keyfile.format !== 'bs-contact-v2-envelope-v1') throw Error('Unexpected key file format');
const privateKey = await crypto.subtle.importKey(
  'pkcs8', fromBase64Url(keyfile.private_key_pkcs8), 'X25519', false, ['deriveBits']
);
const raw = JSON.parse(await readFile(process.argv[3], 'utf8'));
const envelope = raw.envelope || raw;
if (envelope.recipient !== keyfile.recipient) throw Error('Envelope addressed to a different recipient');
console.log(await decryptEnvelope(envelope, privateKey));
