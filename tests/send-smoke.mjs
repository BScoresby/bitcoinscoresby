// Minimal no-network smoke tests; run in repo with a JS ESM-capable runtime.
import { onRequestPost } from '../functions/api/contact/send.js';
const env={CONTACT_DB:{}};
function req(body){return new Request('https://example.org/api/contact/send',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});}
const invalid = await onRequestPost({request:req({}),env});
if(invalid.status!==400 || (await invalid.json()).error!=='Invalid attempt ID')throw Error('Missing ID rejection failed');
const malformed=await onRequestPost({request:req({attempt_id:'00000000-0000-0000-0000-000000000000',event:{kind:14}}),env});
if(malformed.status!==400 || (await malformed.json()).error!=='Invalid NIP-17 gift wrap')throw Error('Malformed event rejection failed');
console.log('PASS: malformed request and malformed event rejected');
