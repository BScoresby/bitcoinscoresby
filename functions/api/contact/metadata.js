// Preview test: public Rizful LNURL metadata. No wallet credentials.
const URL = 'https://rizful.com/.well-known/lnurlp/scoresby';
const SIGNER = 'a8661b3474e11b0e45b273dcaccc2661d7cba4df957c33335ad51bccdc5a37ee';
const HEADERS = { 'Cache-Control': 'no-store' };
function validCallback(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password &&
      (url.hostname === 'rizful.com' || url.hostname.endsWith('.rizful.com'));
  } catch { return false; }
}
export async function onRequestGet() {
  try {
    const response = await fetch(URL, {headers: {'Accept': 'application/json'}, redirect: 'manual', signal: AbortSignal.timeout(10000)});
    if (!response.ok) throw new Error(`Rizful returned HTTP ${response.status}`);
    const info = await response.json();
    if (info.tag !== 'payRequest' || info.allowsNostr !== true ||
        info.nostrPubkey?.toLowerCase() !== SIGNER ||
        !Number.isFinite(info.minSendable) || !Number.isFinite(info.maxSendable) ||
        info.minSendable > 21000 || info.maxSendable < 21000 ||
        !validCallback(info.callback)) throw new Error('Unexpected Rizful LNURL metadata');
    return Response.json({ok:true, allowsNostr:true, nostrPubkey:SIGNER,
      minSendable:info.minSendable, maxSendable:info.maxSendable,
      lnurl_url:URL, callback:info.callback},{headers:HEADERS});
  } catch (error) {
    console.error('Contact metadata test:', error);
    return Response.json({ok:false,error:'Rizful metadata unavailable or changed'},{status:502,headers:HEADERS});
  }
}
