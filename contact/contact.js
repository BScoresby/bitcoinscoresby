import { invoiceQR } from './qrcode.js';
// NIP-57 test helpers derived from the verified local zap tester.
import { giftWrap, decodeNpub, __test } from './nostr-crypto.js';
const RECIPIENT_NPUB = 'npub1w3adlr5sxmkh3dr7efmzh7qtcsd0xn0kmfaagjrkeukj0e4hm4jqrjfxmp';
const RELAYS = ['wss://relay.damus.io', 'wss://relay.primal.net'];
const EXPECTED_PROVIDER = 'a8661b3474e11b0e45b273dcaccc2661d7cba4df957c33335ad51bccdc5a37ee';
const AMOUNT = 21000;
// Same-origin API calls: use on the Cloudflare Pages preview, not localhost.
const API = '/api/contact';
const hex = __test.hex;
const bytes = s => new TextEncoder().encode(s);
const sha = data => __test.hash(data);
function encodeLnurl(url) {
  const alphabet = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  const payload = bytes(url);
  let acc = 0, bits = 0;
  const values = [];
  for (const byte of payload) {
    acc = (acc << 8) | byte;
    bits += 8;
    while (bits >= 5) { bits -= 5; values.push((acc >>> bits) & 31); }
  }
  if (bits) values.push((acc << (5-bits)) & 31);
  const hrp = 'lnurl';
  const expanded = [...hrp].map(c=>c.charCodeAt(0) >> 5)
    .concat([0], [...hrp].map(c=>c.charCodeAt(0) & 31));
  function polymod(data) {
    let chk = 1;
    for (const value of data) {
      const top = chk >>> 25;
      chk = ((chk & 0x1ffffff) << 5) ^ value;
      const gen=[0x3b6a57b2,0x26508e6d,0x1ea119fa,0x3d4233dd,0x2a1462b3];
      for(let i=0;i<5;i++) if((top>>>i)&1) chk ^= gen[i];
    }
    return chk >>> 0;
  }
  const suffix = [0,0,0,0,0,0];
  const mod = polymod(expanded.concat(values,suffix)) ^ 1;
  for(let i=0;i<6;i++) suffix[i] = (mod >>> (5*(5-i))) & 31;
  return hrp+'1'+values.concat(suffix).map(v=>alphabet[v]).join('');
}

async function signedZapRequest(metadata, issuedNonce) {
  const secret = __test.randomSecret();
  const pubkey = hex(__test.publicKey(secret));
  const recipient = decodeNpub(RECIPIENT_NPUB);
  const sessionId = issuedNonce;
  const event = {
    kind: 9734,
    created_at: Math.floor(Date.now()/1000),
    pubkey,
    content: `BitcoinScoresby postage test ${sessionId}`,
    tags: [
      ['relays', ...RELAYS],
      ['amount', String(AMOUNT)],
      ['lnurl', encodeLnurl(metadata.lnurl_url)],
      ['p', recipient]
    ]
  };
  const serialized = JSON.stringify([0,event.pubkey,event.created_at,event.kind,event.tags,event.content]);
  event.id = hex(await sha(bytes(serialized)));
  event.sig = hex(await __test.schnorr(__test.fromHex(event.id),secret));
  return event;
}
// Independent verification of a Nostr BIP-340 event and BOLT11 h tag.
// Uses browser WebCrypto SHA-256, no remote imports or added dependencies.
const SECP_P = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn;
const SECP_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const GX = 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n;
const GY = 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n;
const B32 = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const modP = n => ((n % SECP_P) + SECP_P) % SECP_P;
function powMod(base, exponent, modulus = SECP_P) {
  let result = 1n;
  for (base = ((base % modulus) + modulus) % modulus; exponent > 0n; exponent >>= 1n) {
    if (exponent & 1n) result = result * base % modulus;
    base = base * base % modulus;
  }
  return result;
}
const POINT_INFINITY = {x: 0n, y: 1n, z: 0n};
function twice(p) {
  if (!p.z || !p.y) return POINT_INFINITY;
  const yy = modP(p.y * p.y), s = modP(4n * p.x * yy), m = modP(3n * p.x * p.x);
  const x = modP(m * m - 2n * s);
  return {x, y: modP(m * (s - x) - 8n * yy * yy), z: modP(2n * p.y * p.z)};
}
function addPoints(a, b) {
  if (!a.z) return b;
  if (!b.z) return a;
  const z1 = modP(a.z*a.z), z2=modP(b.z*b.z);
  const u1=modP(a.x*z2), u2=modP(b.x*z1);
  const s1=modP(a.y*b.z*z2), s2=modP(b.y*a.z*z1);
  if (u1===u2) return s1===s2 ? twice(a) : POINT_INFINITY;
  const h=modP(u2-u1), r=modP(s2-s1), hh=modP(h*h), hhh=modP(h*hh), v=modP(u1*hh);
  const x=modP(r*r-hhh-2n*v);
  return {x,y:modP(r*(v-x)-s1*hhh),z:modP(h*a.z*b.z)};
}
function scalarTimes(k, p) {
  let r=POINT_INFINITY, a={...p,z:1n};
  for (; k>0n; k>>=1n) { if(k&1n) r=addPoints(r,a); a=twice(a); }
  return r;
}
function affineXandParity(p) {
  if (!p.z) return null;
  const zi=powMod(p.z,SECP_P-2n), z2=modP(zi*zi);
  return {x:modP(p.x*z2), parity:Number(modP(p.y*z2*zi)&1n)};
}
function liftEvenX(x) {
  if (x>=SECP_P) return null;
  const y2=modP(x*x*x+7n), y=powMod(y2,(SECP_P+1n)/4n);
  if (modP(y*y)!==y2) return null;
  return {x,y:y&1n?SECP_P-y:y};
}
function bytesOfHex(s, expectedLength) {
  if(typeof s!=='string'||s.length!==expectedLength*2||!/^[0-9a-f]+$/i.test(s)) throw Error('Invalid hexadecimal value');
  return Uint8Array.from(s.match(/../g),x=>parseInt(x,16));
}
function concatenate(...parts) {
  const result=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));
  let i=0; for(const p of parts) {result.set(p,i);i+=p.length;} return result;
}
async function taggedHash(tag,data) {
  const t=await sha(bytes(tag));
  return sha(concatenate(t,t,data));
}
async function verifySchnorr(sigHex,pubHex,msgHex) {
  try {
    const signature=bytesOfHex(sigHex,64), pub=bytesOfHex(pubHex,32), msg=bytesOfHex(msgHex,32);
    const r=BigInt('0x'+hex(signature.slice(0,32))), s=BigInt('0x'+hex(signature.slice(32)));
    if (r>=SECP_P || s>=SECP_N) return false;
    const p=liftEvenX(BigInt('0x'+hex(pub)));
    if (!p) return false;
    const challenge=await taggedHash('BIP0340/challenge',concatenate(signature.slice(0,32),pub,msg));
    const e=BigInt('0x'+hex(challenge))%SECP_N;
    const R=addPoints(scalarTimes(s,{x:GX,y:GY}),scalarTimes((SECP_N-e)%SECP_N,{x:p.x,y:p.y}));
    const point=affineXandParity(R);
    return point!==null && point.parity===0 && point.x===r;
  } catch { return false; }
}
async function verifyEvent(event) {
  if (!event || !Number.isSafeInteger(event.created_at) || !Number.isSafeInteger(event.kind) ||
      !Array.isArray(event.tags) || typeof event.content!=='string') return false;
  try {
    bytesOfHex(event.pubkey,32); bytesOfHex(event.id,32);
    const canonical=JSON.stringify([0,event.pubkey,event.created_at,event.kind,event.tags,event.content]);
    if (hex(await sha(bytes(canonical)))!==event.id) return false;
    return verifySchnorr(event.sig,event.pubkey,event.id);
  } catch { return false; }
}
function bech32Polymod(values) {
  let c=1;
  for(const v of values) {
    const b=c>>>25;c=((c&0x1ffffff)<<5)^v;
    const gen=[0x3b6a57b2,0x26508e6d,0x1ea119fa,0x3d4233dd,0x2a1462b3];
    for(let i=0;i<5;i++) if((b>>>i)&1)c^=gen[i];
  }
  return c>>>0;
}
function fromFiveBit(values, strict = true) {
  let acc=0,bits=0;const output=[];
  for(const value of values) {
    acc=(acc<<5)|value;bits+=5;
    while(bits>=8){bits-=8;output.push((acc>>>bits)&255);}
  }
  if(strict && (bits>=5 || ((acc<<(8-bits))&255)!==0))throw Error('Non-zero or excessive padding in bech32 data');
  return new Uint8Array(output);
}
function decodeBolt11(invoice) {
  if(typeof invoice!=='string'||invoice.length>10000||!/^lnbc/i.test(invoice))throw Error('Not a Bitcoin mainnet BOLT11 invoice');
  if(invoice!==invoice.toLowerCase() && invoice!==invoice.toUpperCase())throw Error('Mixed-case bech32 invoice');
  invoice=invoice.toLowerCase();
  const pos=invoice.lastIndexOf('1');
  if(pos<5)throw Error('Missing bech32 separator');
  const hrp=invoice.slice(0,pos), chars=invoice.slice(pos+1);
  const values=Array.from(chars,c=>B32.indexOf(c));
  if(values.some(v=>v<0)||values.length<7+104+6)throw Error('Invalid BOLT11 encoding');
  const expanded=[...hrp].map(c=>c.charCodeAt(0)>>5).concat([0],[...hrp].map(c=>c.charCodeAt(0)&31));
  if(bech32Polymod([...expanded,...values])!==1)throw Error('Bad BOLT11 checksum');
  const amountPart=hrp.slice(4);
  const match=amountPart.match(/^(\d+)([munp]?)$/);
  if(!match)throw Error('BOLT11 invoice has no fixed amount');
  const number=BigInt(match[1]);
  // msats for BTC / milli / micro / nano / pico units.
  const scale={'':100000000000n,m:100000000n,u:100000n,n:100n,p:1n};
  let msats=number*scale[match[2]];
  if(match[2]==='p') {
    if(msats%10n!==0n)throw Error('Sub-millisatoshi amount');
    msats/=10n;
  }
  const payload=values.slice(0,-6);
  const fields=payload.slice(7,-104); // 35-bit timestamp then 520-bit invoice signature.
  let i=0;const tags=[];
  while(i<fields.length) {
    if(i+3>fields.length)throw Error('Truncated BOLT11 tag header');
    const type=B32[fields[i++]], length=fields[i++]*32+fields[i++];
    if(i+length>fields.length)throw Error('Truncated BOLT11 tag data');
    tags.push({type,data:fields.slice(i,i+length)});i+=length;
  }
  const h=tags.filter(t=>t.type==='h');
  if(h.length!==1 || h[0].data.length!==52)throw Error('Expected one 256-bit description hash tag');
  const dh=fromFiveBit(h[0].data);
  if(dh.length!==32)throw Error('Invalid description hash byte length');
  return {msats,descriptionHash:hex(dh)};
}
function exactlyOneTag(tags,name) {
  const hits=tags.filter(t=>Array.isArray(t)&&t[0]===name&&typeof t[1]==='string');
  if(hits.length!==1)throw Error(`Expected exactly one ${name} tag`);
  return hits[0][1];
}


async function verifyReceipt(receipt, attempt) {
  const desc = exactlyOneTag(receipt.tags, 'description');
  const original = JSON.parse(desc);
  const receiver = decodeNpub(RECIPIENT_NPUB);
  const bolt11 = exactlyOneTag(receipt.tags, 'bolt11');
  const invoice = decodeBolt11(bolt11);
  const checks = {
    'Rizful signer': receipt.pubkey === attempt.providerKey,
    'Valid kind-9735 signature': receipt.kind === 9735 && await verifyEvent(receipt),
    'Valid signed kind-9734 request': original.kind === 9734 && await verifyEvent(original),
    'Original request matches': JSON.stringify(original) === JSON.stringify(attempt.request),
    'Invoice matches': bolt11.toLowerCase() === attempt.invoice.toLowerCase(),
    'BOLT11 amount and checksum': invoice.msats === BigInt(AMOUNT),
    'Description hash': invoice.descriptionHash === hex(await sha(bytes(desc))),
    'Receipt recipient': exactlyOneTag(receipt.tags,'p') === receiver,
    'Request recipient': exactlyOneTag(original.tags,'p') === receiver,
    'Request amount': exactlyOneTag(original.tags,'amount') === String(AMOUNT),
    'Request relay list': original.tags.some(t => Array.isArray(t) && t[0] === 'relays' && JSON.stringify(t.slice(1)) === JSON.stringify(RELAYS)),
  };
  return { valid: Object.values(checks).every(Boolean), checks };
}

// LOCAL END-TO-END TEST ONLY. Browser-side payment checks are bypassable.
const form = document.querySelector('#contact-form');
const messageField = document.querySelector('#message');
const replyField = document.querySelector('#reply');
const statusEl = document.querySelector('#status');
const countEl = document.querySelector('#count');
const invoiceBox = document.querySelector('#invoice-area');
const invoiceField = document.querySelector('#invoice');
const qrContainer = document.querySelector('#invoice-qr');
const invoiceButton = document.querySelector('#create-invoice');
const copyButton = document.querySelector('#copy-invoice');
const sendButton = document.querySelector('#send');
const cancelButton = document.querySelector('#cancel-invoice');
const logArea = document.querySelector('#debug-log');
let attempt = null;
let sockets = [];
let paid = false;
let sending = false;
let verifiedReceiptId = null;
let seenReceiptIds = new Set();

function report(text, error = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle('error', error);
}
function log(text) {
  logArea.textContent += `${new Date().toLocaleTimeString()} ${text}\n`;
  console.info('[contact]', text);
}
function stopWatching() {
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close();
  }
  sockets = [];
}
function resetPayment() {
  stopWatching();
  attempt = null;
  paid = false;
  verifiedReceiptId = null;
  seenReceiptIds = new Set();
  invoiceBox.hidden = true;
  qrContainer.replaceChildren();
  invoiceButton.disabled = false;
  sendButton.disabled = true;
  messageField.readOnly = false;
  replyField.readOnly = false;
  invoiceField.value = '';
  cancelButton.hidden = true;
}
messageField.addEventListener('input', () => {
  countEl.textContent = `${messageField.value.length} / 2000`;
});
async function onReceipt(receipt, relay) {
  if (!attempt || paid || receipt?.kind !== 9735 || receipt.pubkey !== attempt.providerKey) return;
  if (seenReceiptIds.has(receipt.id)) return;
  const description = receipt.tags?.find(t => Array.isArray(t) && t[0] === 'description')?.[1];
  if (!description || typeof description !== 'string') return;
  try {
    const req = JSON.parse(description);
    if (req?.id !== attempt.request.id) return;
    seenReceiptIds.add(receipt.id);
    log(`Candidate receipt ${receipt.id} from ${relay}`);
    const result = await verifyReceipt(receipt, attempt);
    for (const [check, ok] of Object.entries(result.checks)) log(` ${ok ? 'PASS' : 'FAIL'} ${check}`);
    if (!result.valid) { report('A matching receipt failed cryptographic verification.', true); return; }
    paid = true;
    verifiedReceiptId = receipt.id;
    sendButton.disabled = false;
    report('21-sat postage verified. You can now send your encrypted message.');
    log('Verified Rizful receipt. Send unlocked (local prototype only).');
    stopWatching();
  } catch (error) {
    log(`Receipt verification error: ${error.message || String(error)}`);
  }
}
function watchReceipts() {
  if (!attempt) return;
  stopWatching();
  for (const relay of RELAYS) {
    let ws;
    try { ws = new WebSocket(relay); } catch (e) { log(`${relay}: ${e.message}`); continue; }
    sockets.push(ws);
    const subId = 'scoresby-' + crypto.randomUUID().slice(0, 12);
    ws.onopen = () => {
      log(`Connected to receipt relay ${relay}`);
      ws.send(JSON.stringify(['REQ', subId, {
        kinds: [9735], authors: [attempt.providerKey],
        '#p': [decodeNpub(RECIPIENT_NPUB)], since: attempt.request.created_at - 60, limit: 100
      }]));
    };
    ws.onmessage = ({data}) => {
      try {
        const arr = JSON.parse(data);
        if (arr[0] === 'EVENT' && arr[1] === subId) void onReceipt(arr[2], relay);
        if (arr[0] === 'NOTICE') log(`${relay} NOTICE: ${arr[1]}`);
        if (arr[0] === 'CLOSED') log(`${relay} CLOSED: ${arr[2]}`);
      } catch (e) { log(`Receipt message parsing error: ${e.message}`); }
    };
    ws.onerror = () => log(`Receipt relay WebSocket error: ${relay}`);
    ws.onclose = e => { if (!paid) log(`${relay} disconnected: ${e.code}`); };
  }
}
invoiceButton.addEventListener('click', async () => {
  if (sending || attempt || invoiceButton.disabled || !messageField.value.trim()) {
    report('Write a message before requesting postage.', true); return;
  }
  resetPayment();
  invoiceButton.disabled = true;
  logArea.textContent = '';
  report('Requesting a 21-sat zap invoice...');
  try {
    // Start a server-controlled payment attempt.
    const startResp = await fetch(`${API}/start`, {method:'POST'});
    const started = await startResp.json();
    if (!startResp.ok || !started.ok) throw Error(started.error || 'Could not start payment attempt');
    if (started.amount_msats !== AMOUNT) throw Error('Unexpected server postage amount');
    const metadataResp = await fetch(`${API}/metadata`);
    const metadata = await metadataResp.json();
    if (!metadataResp.ok) throw Error(metadata.error || 'LNURL metadata failed');
    if (metadata.allowsNostr !== true || metadata.nostrPubkey?.toLowerCase() !== EXPECTED_PROVIDER) throw Error('Unexpected Rizful NIP-57 metadata');
    if (!(metadata.minSendable <= AMOUNT && AMOUNT <= metadata.maxSendable)) throw Error('21 sats outside provider limits');
    const request = await signedZapRequest(metadata, started.nonce);
    const invoiceResp = await fetch(`${API}/invoice`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ attempt_id: started.attempt_id, request }) });
    const response = await invoiceResp.json();
    const invoice = response.invoice || response.pr;
    if (!invoiceResp.ok || !response.ok || typeof invoice !== 'string' || !/^lnbc/i.test(invoice)) {
      throw Error(response.error || response.reason || 'Invoice request failed');
    }
    // Register the invoice and zap request with Cloudflare; this does not verify payment.
    const regResp = await fetch(`${API}/register`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({attempt_id:started.attempt_id,request,invoice})
    });
    const registered = await regResp.json();
    if (!regResp.ok || !registered.ok) throw Error(registered.error || 'Could not register invoice');
    log(`Cloudflare registered payment attempt ${started.attempt_id}`);
    attempt = { request, providerKey: EXPECTED_PROVIDER, invoice };
    invoiceField.value = invoice;
    try {
      qrContainer.replaceChildren(invoiceQR(invoice));
    } catch (qrError) {
      log(`QR rendering unavailable: ${qrError.message}`);
      report('Invoice created, but QR could not be generated. Use Copy invoice.', true);
    }
    invoiceBox.hidden = false;
    cancelButton.hidden = false;
    // Freeze draft while payment is pending so the visitor knows which draft is being sent.
    messageField.readOnly = true;
    replyField.readOnly = true;
    watchReceipts();
    report('Invoice ready. Pay 21 sats, then the Send button will unlock automatically.');
    log(`Created request ${request.id}`);
  } catch (error) {
    report(`Invoice error: ${error.message || String(error)}`, true);
    resetPayment();
  }
});
cancelButton.addEventListener('click', () => {
  if (sending) return;
  resetPayment();
  report('Invoice abandoned. Unpaid invoices cannot be reused.');
});
copyButton.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(invoiceField.value); report('Invoice copied. Waiting for payment...'); }
  catch { invoiceField.select(); document.execCommand('copy'); report('Invoice selected/copied. Waiting for payment...'); }
});

// Send the standard NIP-17 gift wrap to the two relays already proven to work.
function publish(relay, event, timeoutMs = 12000) {
  return new Promise(resolve => {
    let ws, done = false;
    const start = performance.now();
    const timer = setTimeout(() => finish(false, 'Timed out'), timeoutMs);
    function finish(ok, detail) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) ws.close();
      resolve({ relay, ok, detail, ms: Math.round(performance.now() - start) });
    }
    try {
      ws = new WebSocket(relay);
      ws.onopen = () => ws.send(JSON.stringify(['EVENT', event]));
      ws.onmessage = ({data}) => {
        try {
          const arr = JSON.parse(data);
          if (arr[0] === 'OK' && arr[1] === event.id) finish(arr[2] === true, String(arr[3] || (arr[2] ? 'Accepted' : 'Rejected')));
          else if (arr[0] === 'NOTICE') log(`${relay} NOTICE: ${arr[1]}`);
          else if (arr[0] === 'AUTH') log(`${relay} requested authentication`);
        } catch (e) { log(`${relay} response error: ${e.message}`); }
      };
      ws.onerror = () => log(`${relay} WebSocket error`);
      ws.onclose = e => finish(false, `Closed (${e.code}) before acknowledgment`);
    } catch (error) { finish(false, error.message); }
  });
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!paid || !verifiedReceiptId || !attempt || sending) {
    report('Payment has not yet been verified.', true);
    return;
  }
  sending = true;
  sendButton.disabled = true;
  report('Encrypting and publishing your message...');
  try {
    const text = messageField.value.trim();
    if (!text) throw Error('Message is empty');
    const address = replyField.value.trim();
    const content = address ? `${text}\n\nReply address: ${address}` : text;
    const wrap = await giftWrap(content, decodeNpub(RECIPIENT_NPUB));
    const results = await Promise.all(RELAYS.map(relay => publish(relay, wrap)));
    for (const r of results) log(`${r.relay}: ${r.ok ? 'ACCEPTED' : 'FAILED'} (${r.ms} ms): ${r.detail}`);
    if (!results.some(r => r.ok)) {
      report('Neither relay confirmed delivery. You can retry sending with the same payment.', true);
      sendButton.disabled = false;
      return;
    }
    // Local-only one-use UI; server-side single-use enforcement is required for production.
    report(`Message published to ${results.filter(r => r.ok).length}/${RELAYS.length} relays. Check Amethyst.`);
    log(`Published NIP-17 event ${wrap.id}; matched zap receipt ${verifiedReceiptId}`);
    resetPayment();
    messageField.value = '';
    replyField.value = '';
    countEl.textContent = '0 / 2000';
  } catch (error) {
    report(`Send error: ${error.message || String(error)}`, true);
    sendButton.disabled = false;
  } finally { sending = false; }
});
resetPayment();
report('Write a message to begin. Postage: 21 sats.');
