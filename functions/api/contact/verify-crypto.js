// Server-side NIP-57 receipt verification; no browser trust is assumed.
const hex = data => Array.from(data, b => b.toString(16).padStart(2, '0')).join('');
const bytes = text => new TextEncoder().encode(text);
const sha = async data => new Uint8Array(await crypto.subtle.digest('SHA-256', data));
const RECIPIENT = '747adf8e9036ed78b47eca762bf80bc41af34df6da7bd44876cf2d27e6b7dd64';
const SIGNER = 'a8661b3474e11b0e45b273dcaccc2661d7cba4df957c33335ad51bccdc5a37ee';
const RELAYS = ['wss://relay.damus.io', 'wss://relay.primal.net'];
const AMOUNT = 21000;
const LNURL = 'https://rizful.com/.well-known/lnurlp/scoresby';
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



const equalsHex = (a, b) => typeof a === 'string' && a.toLowerCase() === b;
function onlyTag(tags, name) {
  if (!Array.isArray(tags)) throw Error('Invalid tags');
  return exactlyOneTag(tags, name);
}
export async function validateZapReceipt(receipt, row) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) throw Error('Invalid receipt');
  if (!row || row.state !== 'invoiced' || !row.invoice || !row.zap_request_id || !row.nonce) throw Error('Attempt not invoiced');
  const now = Math.floor(Date.now() / 1000);
  if (now > Number(row.created_at) + 7 * 86400) throw Error('Attempt too old');
  if (receipt.kind !== 9735 || !equalsHex(receipt.pubkey, SIGNER) || !(await verifyEvent(receipt))) throw Error('Invalid Rizful receipt signature');
  if (receipt.created_at < Number(row.created_at) - 120 || receipt.created_at > Number(row.expires_at) + 3600 || receipt.created_at > now + 120) throw Error('Receipt timestamp outside allowed interval');
  const desc = onlyTag(receipt.tags, 'description');
  if (desc.length > 12000) throw Error('Oversized request description');
  const original = JSON.parse(desc);
  if (original.kind !== 9734 || !(await verifyEvent(original))) throw Error('Invalid zap request signature');
  if (!equalsHex(original.id, row.zap_request_id)) throw Error('Zap request does not match registration');
  if (original.content !== `BitcoinScoresby postage test ${row.nonce}`) throw Error('Nonce missing or incorrect');
  if (Math.abs(original.created_at - Number(row.created_at)) > 300) throw Error('Zap request created outside attempt window');
  if (onlyTag(original.tags, 'amount') !== String(AMOUNT)) throw Error('Wrong zap amount');
  if (!equalsHex(onlyTag(original.tags, 'p'), RECIPIENT) || !equalsHex(onlyTag(receipt.tags, 'p'), RECIPIENT)) throw Error('Wrong recipient');
  if (onlyTag(original.tags, 'lnurl') !== encodeLnurl(LNURL)) throw Error('Incorrect LNURL');
  const relayTags = original.tags.filter(t=>Array.isArray(t) && t[0] === 'relays');
  if (relayTags.length !== 1 || JSON.stringify(relayTags[0].slice(1)) !== JSON.stringify(RELAYS)) throw Error('Incorrect relays');
  if (original.tags.some(t=>Array.isArray(t) && (t[0] === 'e' || t[0] === 'a'))) throw Error('Unexpected zap target');
  const bolt11 = onlyTag(receipt.tags, 'bolt11');
  if (bolt11.toLowerCase() !== row.invoice.toLowerCase()) throw Error('Invoice differs from registered invoice');
  const invoice = decodeBolt11(bolt11);
  if (invoice.msats !== BigInt(AMOUNT)) throw Error('Incorrect invoice amount');
  if (invoice.descriptionHash !== hex(await sha(bytes(desc)))) throw Error('Invoice description hash mismatch');
  return { receipt_id: receipt.id.toLowerCase(), request_id: original.id.toLowerCase() };
}

export { verifyEvent as verifyNostrEvent };
