// Minimal, dependency-free BOLT11 structural parser for invoices returned by
// Lexe over HTTPS. Checks bech32 checksum, mainnet amount, payment hash, expiry.
// This is not an independent invoice-signature verification implementation.
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

function polymod(values) {
  let chk = 1;
  for (const v of values) {
    const top = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((top >>> i) & 1) chk ^= GENERATOR[i];
  }
  return chk >>> 0;
}

function expandHrp(hrp) {
  return [...hrp].map(c => c.charCodeAt(0) >>> 5)
    .concat([0], [...hrp].map(c => c.charCodeAt(0) & 31));
}

function toBytes(words) {
  const bytes = [];
  let value = 0, bits = 0;
  for (const word of words) {
    if (word < 0 || word > 31) throw Error('Invalid word');
    value = (value << 5) | word;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 255);
    }
  }
  if (bits >= 5 || ((value << (8 - bits)) & 255) !== 0) {
    throw Error('Invalid padded field');
  }
  return new Uint8Array(bytes);
}

function wordsInteger(words) {
  let n = 0n;
  for (const word of words) n = (n << 5n) | BigInt(word);
  if (n > BigInt(Number.MAX_SAFE_INTEGER)) throw Error('Numeric field too large');
  return Number(n);
}

function amountMsat(hrp) {
  const match = /^lnbc([1-9][0-9]*)([munp]?)$/.exec(hrp);
  if (!match) throw Error('Requires amount-specified Bitcoin mainnet invoice');
  const quantity = BigInt(match[1]);
  const unit = match[2];
  const factor = { '': 100000000000n, m: 100000000n, u: 100000n, n: 100n };
  const amount = unit === 'p'
    ? (quantity % 10n === 0n ? quantity / 10n : (() => { throw Error('Fractional millisatoshis'); })())
    : quantity * factor[unit];
  if (amount > BigInt(Number.MAX_SAFE_INTEGER)) throw Error('Amount too large');
  return Number(amount);
}

export function decodeBolt11(invoice) {
  if (typeof invoice !== 'string' || invoice.length < 140 || invoice.length > 8192) {
    throw Error('Invalid invoice length');
  }
  if (invoice !== invoice.toLowerCase() && invoice !== invoice.toUpperCase()) {
    throw Error('Mixed-case Bech32');
  }
  const s = invoice.toLowerCase();
  const separator = s.lastIndexOf('1');
  if (separator < 1 || separator + 7 > s.length) throw Error('Invalid Bech32 separator');
  const hrp = s.slice(0, separator);
  const msat = amountMsat(hrp);
  const words = [...s.slice(separator + 1)].map(c => CHARSET.indexOf(c));
  if (words.some(w => w < 0) || polymod(expandHrp(hrp).concat(words)) !== 1) {
    throw Error('Invalid Bech32 checksum');
  }
  const data = words.slice(0, -6);
  if (data.length < 7 + 104) throw Error('Missing invoice signature');
  const timestamp = wordsInteger(data.slice(0, 7));
  const tags = data.slice(7, -104);
  let paymentHash = null;
  let expirySeconds = 3600;
  let expirySeen = false;
  for (let i = 0; i < tags.length;) {
    if (i + 3 > tags.length) throw Error('Truncated invoice tag');
    const type = tags[i++];
    const count = (tags[i++] << 5) | tags[i++];
    if (i + count > tags.length) throw Error('Truncated invoice tag value');
    const content = tags.slice(i, i + count);
    i += count;
    if (type === CHARSET.indexOf('p')) {
      if (paymentHash !== null) throw Error('Duplicate payment hash');
      const bytes = toBytes(content);
      if (bytes.length !== 32) throw Error('Invalid payment hash');
      paymentHash = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
    }
    if (type === CHARSET.indexOf('x')) {
      if (expirySeen) throw Error('Duplicate expiry');
      expirySeen = true;
      expirySeconds = wordsInteger(content);
    }
  }
  if (!paymentHash) throw Error('No payment hash');
  if (expirySeconds <= 0) throw Error('Expired invoice');
  return { amount_msat: msat, payment_hash: paymentHash,
    invoice_expires_at: timestamp + expirySeconds };
}
