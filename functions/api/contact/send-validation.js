import { verifyNostrEvent } from './verify-crypto.js';
function isNip44V2Payload(value) {
  if (typeof value !== 'string' ||
      value.length > 10000 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    return false;
  }

  try {
    const decoded = atob(value);

    // Version byte + 32-byte nonce + minimum padded
    // ciphertext + 32-byte MAC.
    return decoded.length >= 99 &&
           decoded.charCodeAt(0) === 2 &&
           btoa(decoded) === value;
  } catch {
    return false;
  }
}
export async function validateGiftWrap(event, recipient) {
  if (typeof recipient !== 'string' || !/^[0-9a-f]{64}$/.test(recipient)) return false;
  if(!event||typeof event!=='object'||Array.isArray(event))return false;
  if (event.kind !== 1059 || !isNip44V2Payload(event.content)) return false;
  if(!Array.isArray(event.tags)||event.tags.length!==1||!Array.isArray(event.tags[0])||event.tags[0].length!==2||event.tags[0][0]!=='p'||event.tags[0][1]!==recipient)return false;
  const now=Math.floor(Date.now()/1000);
  if(!Number.isSafeInteger(event.created_at)||event.created_at>now+120||event.created_at<now-4*86400)return false;
  return verifyNostrEvent(event);
}
