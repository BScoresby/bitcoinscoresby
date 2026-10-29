import { validateGiftWrap } from './send-validation.js';

const fail = (status, error, extra = {}) => Response.json({ok:false,error,...extra},{status,headers:{'Cache-Control':'no-store'}});
const RELAYS = ['wss://relay.damus.io','wss://relay.primal.net'];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function publish(relay, event, timeoutMs = 8500) {
  return new Promise(resolve => {
    let socket, finished = false;
    const timer = setTimeout(() => finish(false,'timeout'),timeoutMs);
    function finish(ok,reason) {
      if (finished) return;
      finished=true; clearTimeout(timer);
      try { socket?.close(); } catch {}
      resolve({relay,ok,reason});
    }
    try {
      socket = new WebSocket(relay);
      socket.addEventListener('open',() => socket.send(JSON.stringify(['EVENT',event])));
      socket.addEventListener('message',({data}) => {
        try {
          const msg=JSON.parse(data);
          if(msg[0]==='OK' && msg[1]===event.id) finish(msg[2]===true, String(msg[3]||'relay response'));
          if(msg[0]==='AUTH') finish(false,'relay requires authentication');
        } catch {}
      });
      socket.addEventListener('error',()=>finish(false,'socket error'));
      socket.addEventListener('close',()=>finish(false,'socket closed'));
    } catch (error) { finish(false,'connection failed'); }
  });
}

export async function onRequestPost({request,env}) {
  if(!env.CONTACT_DB) return fail(503,'Database unavailable');
  const size=Number(request.headers.get('content-length')||0);
  if(size>15000)return fail(413,'Request too large');
  let body;
  try {const raw=await request.text(); if(raw.length>15000)return fail(413,'Request too large');body=JSON.parse(raw);}catch{return fail(400,'Invalid JSON');}
  const id=body?.attempt_id, event=body?.event;
  if(typeof id!=='string'||!uuidPattern.test(id))return fail(400,'Invalid attempt ID');
  if(!await validateGiftWrap(event))return fail(400,'Invalid NIP-17 gift wrap');
  const eventJSON=JSON.stringify(event);
  const now=Math.floor(Date.now()/1000);
  let row;
  try {row=await env.CONTACT_DB.prepare(`SELECT state, delivery_event_id, delivery_event, send_started_at, receipt_id FROM contact_attempts WHERE id=?`).bind(id).first();}
  catch(error){console.error('Contact send D1 read:',error);return fail(503,'Database unavailable');}
  if(!row)return fail(404,'Unknown attempt');
  if(row.state==='sent')return row.delivery_event_id===event.id ? Response.json({ok:true,state:'sent',event_id:event.id,already_sent:true}) : fail(409,'Payment already used for another message');
  if(row.state!=='paid'&&row.state!=='sending')return fail(409,'Payment not verified');
  if(row.delivery_event_id && row.delivery_event_id!==event.id)return fail(409,'Payment is bound to another message');
  if(row.state==='sending' && Number(row.send_started_at||0)>now-40)return fail(409,'Delivery already in progress',{retry_after_seconds:40});

  // A single atomic UPDATE reserves the payment for precisely this event ID.
  // When retrying, the event must be byte-for-byte identical to the originally pinned event.
  let claim;
  try {
    claim=await env.CONTACT_DB.prepare(`
      UPDATE contact_attempts
      SET state='sending', delivery_event_id=?, delivery_event=?, send_started_at=?
      WHERE id=? AND receipt_id IS NOT NULL
      AND (state='paid' OR (state='sending' AND send_started_at < ?))
      AND (delivery_event_id IS NULL OR (delivery_event_id=? AND delivery_event=?))
    `).bind(event.id,eventJSON,now,id,now-40,event.id,eventJSON).run();
  }catch(error){console.error('Contact send claim:',error);return fail(503,'Could not claim payment');}
  if(claim.meta?.changes!==1)return fail(409,'Payment already claimed or event differs');

  const results=await Promise.all(RELAYS.map(r=>publish(r,event)));
  const delivered=results.some(r=>r.ok);
  if(delivered){
    try {
      await env.CONTACT_DB.prepare(`UPDATE contact_attempts SET state='sent' WHERE id=? AND state='sending' AND delivery_event_id=? AND delivery_event=?`).bind(id,event.id,eventJSON).run();
    }catch(error){console.error('Contact send confirmation:',error);return fail(503,'Relay accepted event, but database confirmation failed. Retry the same event later.');}
    return Response.json({ok:true,state:'sent',event_id:event.id,relays:results},{headers:{'Cache-Control':'no-store'}});
  }
  // Keep state='sending' and the pinned event. A retry after 40 seconds can only resend this identical event.
  return fail(503,'Relays did not acknowledge delivery. Retry the same message after 40 seconds.',{state:'sending',event_id:event.id,relays:results});
}
