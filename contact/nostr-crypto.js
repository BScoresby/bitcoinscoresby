// Experimental NIP-17/NIP-44 v2 sender. Self-contained, uses WebCrypto for SHA-256/HMAC.
// Curve arithmetic, BIP340 Schnorr and ChaCha20 implemented locally.
// Not independently audited. Do not use for high-value keys or high-risk communications.
const P = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn;
const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const G = {x: 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n, y: 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n};
const enc = new TextEncoder();
const mod = (a,m=P)=>((a%m)+m)%m;
function pow(a,e,m=P) { let z=1n; for(a=mod(a,m);e>0n;e>>=1n,a=a*a%m) if(e&1n)z=z*a%m; return z; }
function inv(a){return pow(a,P-2n);}
// Jacobian coordinates avoid affine inversion on every curve addition.
const J0={x:0n,y:1n,z:0n};
function jDouble(a){if(!a.z||!a.y)return J0;const yy=mod(a.y*a.y),s=mod(4n*a.x*yy),m=mod(3n*a.x*a.x),x=mod(m*m-2n*s);return{x,y:mod(m*(s-x)-8n*yy*yy),z:mod(2n*a.y*a.z)};}
function jAdd(a,b){if(!a.z)return b;if(!b.z)return a;const z1=mod(a.z*a.z),z2=mod(b.z*b.z),u1=mod(a.x*z2),u2=mod(b.x*z1),s1=mod(a.y*b.z*z2),s2=mod(b.y*a.z*z1);if(u1===u2)return s1===s2?jDouble(a):J0;const h=mod(u2-u1),r=mod(s2-s1),hh=mod(h*h),hhh=mod(h*hh),v=mod(u1*hh);return{x:mod(r*r-hhh-2n*v),y:mod(r*(v-mod(r*r-hhh-2n*v))-s1*hhh),z:mod(h*a.z*b.z)};}
function multiply(k,point){let r=J0,a={...point,z:1n};for(;k>0n;k>>=1n,a=jDouble(a))if(k&1n)r=jAdd(r,a);if(!r.z)throw Error('Invalid EC point');const zi=inv(r.z),zi2=mod(zi*zi);return{x:mod(r.x*zi2),y:mod(r.y*zi2*zi)};}
const cat=(...args)=>{const out=new Uint8Array(args.reduce((s,a)=>s+a.length,0));let n=0;for(const a of args){out.set(a,n);n+=a.length;}return out;};
const hex=a=>Array.from(a,x=>x.toString(16).padStart(2,'0')).join('');
const fromHex=h=>Uint8Array.from(h.match(/../g).map(x=>parseInt(x,16)));
const bn=a=>BigInt('0x'+hex(a));
const bytes=n=>fromHex(n.toString(16).padStart(64,'0'));
const rng=n=>crypto.getRandomValues(new Uint8Array(n));
async function hash(data){return new Uint8Array(await crypto.subtle.digest('SHA-256',data));}
async function hmac(key,data){let k=await crypto.subtle.importKey('raw',key,{name:'HMAC',hash:'SHA-256'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',k,data));}
async function tagged(tag,data){const t=await hash(enc.encode(tag));return hash(cat(t,t,data));}
function publicKey(secret){return bytes(multiply(bn(secret),G).x);}
function randomSecret(){let b;do{b=rng(32);}while(bn(b)===0n||bn(b)>=N);return b;}
function liftX(x){if(x>=P)throw Error('Invalid recipient key');const y2=mod(x*x*x+7n),y=pow(y2,(P+1n)/4n);if(mod(y*y)!==y2)throw Error('Recipient is not on secp256k1');return{x,y:y&1n?P-y:y};}
async function schnorr(message,secret){const d0=bn(secret),pt=multiply(d0,G);const d=(pt.y&1n)?N-d0:d0;const aux=rng(32),ah=await tagged('BIP0340/aux',aux),t=bytes(d).map((v,i)=>v^ah[i]);const k0=bn(await tagged('BIP0340/nonce',cat(t,bytes(pt.x),message)))%N;if(!k0)throw Error('Bad nonce');const rp=multiply(k0,G),k=(rp.y&1n)?N-k0:k0;const e=bn(await tagged('BIP0340/challenge',cat(bytes(rp.x),bytes(pt.x),message)))%N;return cat(bytes(rp.x),bytes(mod(k+e*d,N)));}
function ecdh(secret,recipient){return bytes(multiply(bn(secret),liftX(bn(recipient))).x);}
async function hkdfExpand(prk,info,len){let result=new Uint8Array(0),last=new Uint8Array(0);for(let i=1;result.length<len;i++){last=await hmac(prk,cat(last,info,Uint8Array.of(i)));result=cat(result,last);}return result.slice(0,len);}
function chacha20(key,nonce,msg){const c=new Uint32Array(16),dv=new DataView(c.buffer);const constants=enc.encode('expand 32-byte k');for(let i=0;i<4;i++)c[i]=new DataView(constants.buffer).getUint32(i*4,true);for(let i=0;i<8;i++)c[4+i]=new DataView(key.buffer,key.byteOffset).getUint32(i*4,true);for(let i=0;i<3;i++)c[13+i]=new DataView(nonce.buffer,nonce.byteOffset).getUint32(i*4,true);
 const out=new Uint8Array(msg.length),rot=(x,n)=>(x<<n)|(x>>>(32-n));
 function q(s,a,b,d,e){s[a]=(s[a]+s[b])>>>0;s[e]^=s[a];s[e]=rot(s[e],16);s[d]=(s[d]+s[e])>>>0;s[b]^=s[d];s[b]=rot(s[b],12);s[a]=(s[a]+s[b])>>>0;s[e]^=s[a];s[e]=rot(s[e],8);s[d]=(s[d]+s[e])>>>0;s[b]^=s[d];s[b]=rot(s[b],7);}
 for(let at=0,counter=0;at<msg.length;at+=64,counter++){const state=c.slice();state[12]=counter;const w=state.slice();for(let i=0;i<10;i++){q(w,0,4,8,12);q(w,1,5,9,13);q(w,2,6,10,14);q(w,3,7,11,15);q(w,0,5,10,15);q(w,1,6,11,12);q(w,2,7,8,13);q(w,3,4,9,14);}const block=new Uint8Array(64),view=new DataView(block.buffer);for(let i=0;i<16;i++)view.setUint32(i*4,(w[i]+state[i])>>>0,true);for(let i=0;i<64&&at+i<msg.length;i++)out[at+i]=msg[at+i]^block[i];}return out;}
function paddedLength(n){if(n<=32)return 32;const next=2**Math.ceil(Math.log2(n));const chunk=next<=256?32:next/8;return chunk*Math.floor((n-1)/chunk+1);}
async function encryptNip44(plaintext,secret,recipient){const shared=ecdh(secret,recipient);const conversation=await hmac(enc.encode('nip44-v2'),shared);const nonce=rng(32),keys=await hkdfExpand(conversation,nonce,76);const data=enc.encode(plaintext);if(!data.length||data.length>65535)throw Error('Message too long');const padded=new Uint8Array(2+paddedLength(data.length));padded[0]=data.length>>>8;padded[1]=data.length&255;padded.set(data,2);const cipher=chacha20(keys.slice(0,32),keys.slice(32,44),padded),mac=await hmac(keys.slice(44),cat(nonce,cipher));const packed=cat(Uint8Array.of(2),nonce,cipher,mac);let s='';for(const byte of packed)s+=String.fromCharCode(byte);return btoa(s);}
async function eventId(ev){return hash(enc.encode(JSON.stringify([0,ev.pubkey,ev.created_at,ev.kind,ev.tags,ev.content])));}
async function finalize(ev,secret){ev.pubkey=hex(publicKey(secret));ev.id=hex(await eventId(ev));ev.sig=hex(await schnorr(fromHex(ev.id),secret));return ev;}
function pastTime(){return Math.floor(Date.now()/1000)-Math.floor(Math.random()*172800);}
export async function giftWrap(message,recipientHex){if(!/^[0-9a-f]{64}$/i.test(recipientHex))throw Error('Invalid recipient hex key');const recipient=fromHex(recipientHex),sender=randomSecret(),wrapper=randomSecret();const rumor={kind:14,pubkey:hex(publicKey(sender)),created_at:Math.floor(Date.now()/1000),tags:[['p',recipientHex]],content:message};rumor.id=hex(await eventId(rumor));const seal=await finalize({kind:13,created_at:pastTime(),tags:[],content:await encryptNip44(JSON.stringify(rumor),sender,recipient)},sender);return finalize({kind:1059,created_at:pastTime(),tags:[['p',recipientHex]],content:await encryptNip44(JSON.stringify(seal),wrapper,recipient)},wrapper);}
// NIP-19 decode (npub only), including bech32 checksum.
export function decodeNpub(value){const s=value.trim().toLowerCase(),pos=s.lastIndexOf('1');if(!s.startsWith('npub1')||pos<1||s.length>90)throw Error('Invalid npub');const chars='qpzry9x8gf2tvdw0s3jn54khce6mua7l',raw=Array.from(s.slice(pos+1),c=>chars.indexOf(c));if(raw.some(v=>v<0))throw Error('Invalid bech32 character');function polymod(xs){let c=1;for(const v of xs){const b=c>>>25;c=((c&0x1ffffff)<<5)^v;for(let i=0;i<5;i++)if((b>>>i)&1)c^=[0x3b6a57b2,0x26508e6d,0x1ea119fa,0x3d4233dd,0x2a1462b3][i];}return c>>>0;}const expand=[...s.slice(0,pos)].map(c=>c.charCodeAt(0)>>>5).concat([0],[...s.slice(0,pos)].map(c=>c.charCodeAt(0)&31));if(polymod([...expand,...raw])!==1)throw Error('Bad npub checksum');let acc=0,bits=0,out=[];for(const x of raw.slice(0,-6)){acc=(acc<<5)|x;bits+=5;if(bits>=8){bits-=8;out.push((acc>>>bits)&255);}}if(out.length!==32||bits>=5||((acc<<(8-bits))&255))throw Error('Invalid npub length');return hex(out);}
export const __test={hex,fromHex,hash,publicKey,randomSecret,schnorr,ecdh,encryptNip44};
