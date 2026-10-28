import { verifyNostrEvent } from './verify-crypto.js';
const RECIPIENT = '747adf8e9036ed78b47eca762bf80bc41af34df6da7bd44876cf2d27e6b7dd64';
export async function validateGiftWrap(event) {
  if(!event||typeof event!=='object'||Array.isArray(event))return false;
  if(event.kind!==1059 || typeof event.content!=='string'||event.content.length>10000||!event.content.startsWith('Ag'))return false;
  if(!Array.isArray(event.tags)||event.tags.length!==1||!Array.isArray(event.tags[0])||event.tags[0].length!==2||event.tags[0][0]!=='p'||event.tags[0][1]!==RECIPIENT)return false;
  const now=Math.floor(Date.now()/1000);
  if(!Number.isSafeInteger(event.created_at)||event.created_at>now+120||event.created_at<now-4*86400)return false;
  return verifyNostrEvent(event);
}
