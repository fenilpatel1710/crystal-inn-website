/**
 * Durable stay-request notification dispatcher (server-side only).
 *
 * "Accepted" means provider queued the message, NOT delivered to inbox/phone.
 * Only request-received messages are currently dispatched. Confirmed
 * reservation notifications require separate staff/PMS confirmation.
 */
import 'server-only';
import {getCloudflareContext} from '@opennextjs/cloudflare';
import type {DB} from './admin/auth';

export type RequestChannel='property_request_email'|'guest_request_email'|'guest_request_sms'|'guest_confirmed_email'|'guest_confirmed_sms';
type Job={
 id:string;channel:RequestChannel;state:string;reservation_id:string;hotel_id:string;
 reference:string;first_name:string;last_name:string;phone_e164:string;email:string;
 room_type_label:string;check_in:string;check_out:string;rooms_count:number;guests_count:number;
 special_requests:string|null;hotel_name:string;public_email:string|null;booking_notification_email:string|null;
 guest_email_enabled:number;guest_sms_enabled:number;sms_updates_consent:number;
 booking_status:string;lumen_booking_code:string|null;
};
type DispatchStatus='accepted'|'pending'|'failed'|'not_requested';
export type RequestDispatch={propertyEmail:DispatchStatus;guestEmail:DispatchStatus;guestSms:DispatchStatus};
const requestChannels:RequestChannel[]=['property_request_email','guest_request_email','guest_request_sms'];
const confirmedChannels:RequestChannel[]=['guest_confirmed_email','guest_confirmed_sms'];
function envText(e:Record<string,unknown>,key:string){
 return typeof e[key]==='string'?(e[key] as string).trim():'';
}
function emailValid(value:string){
 return value.length<=190&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
function xml(value:string){
 return value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
}
export function reservationText(job:Pick<Job,'reference'|'first_name'|'last_name'|'check_in'|'check_out'|'room_type_label'|'rooms_count'|'guests_count'|'special_requests'|'hotel_name'|'phone_e164'|'email'>,staff:boolean){
 const lines=[
  staff?'New reservation REQUEST — not confirmed':'We received your stay REQUEST — not confirmed',
  'Hotel: '+job.hotel_name,'Reference: '+job.reference,
  'Guest: '+job.first_name+' '+job.last_name,
  'Check-in: '+job.check_in,'Check-out: '+job.check_out,
  'Room preference: '+job.room_type_label,'Rooms: '+job.rooms_count,'Guests: '+job.guests_count
 ];
 if(staff)lines.push('Contact email: '+job.email,'Contact phone: '+job.phone_e164,'Notes: '+(job.special_requests||'(none)'));
 lines.push(staff?'Check availability and price in Lumen and contact the guest. No PMS booking has been created.':
  'The property must check availability and price. No room is held or confirmed yet. The hotel will contact you after review.');
 return lines.join('\n');
}
export function reservationSms(job:Pick<Job,'hotel_name'|'reference'|'check_in'|'check_out'>){
 return job.hotel_name+': We received your stay REQUEST '+job.reference+' ('+job.check_in+' to '+job.check_out+
 '). This is NOT a confirmed booking. Hotel staff will review availability. Reply STOP to opt out.';
}
function confirmedEmail(job:Job){
 return 'Reservation CONFIRMED by '+job.hotel_name+' staff after their PMS check.\n'+
  'PMS Booking Reference: '+job.lumen_booking_code+'\n'+
  'Website Reference: '+job.reference+'\n'+
  'Registered Guest: '+job.first_name+' '+job.last_name+'\n'+
  'Check-in: '+job.check_in+'\nCheck-out: '+job.check_out+
  '\nRoom preference: '+job.room_type_label+
  '\nContact your property directly for final room assignment and payment/deposit policies.';
}
function confirmedSms(job:Job){
 return job.hotel_name+': Your reservation '+job.reference+' is CONFIRMED by hotel staff. PMS: '+
  job.lumen_booking_code+'. Stay '+job.check_in+' to '+job.check_out+
  '. Contact hotel for details. Reply STOP to opt out.';
}
function safelyError(code:string){return code.replace(/[^a-z0-9_]/g,'').slice(0,40)||'unknown';}
export async function dispatchReservationNotifications(db:DB,reservationId:string,purpose:'request'|'confirmed'='request'):Promise<RequestDispatch>{
 const output:RequestDispatch={propertyEmail:purpose==='confirmed'?'not_requested':'pending',guestEmail:'pending',guestSms:'not_requested'};
 const channels=purpose==='confirmed'?confirmedChannels:requestChannels;
 const e=getCloudflareContext().env as unknown as Record<string,unknown>;
 let jobs:Job[];
 try{
  const data=await db.prepare(`SELECT n.id,n.channel,n.state,n.reservation_id,n.hotel_id,
    r.public_reference AS reference,r.first_name,r.last_name,r.phone_e164,r.email,
    r.room_type_label,r.check_in,r.check_out,r.rooms_count,r.guests_count,r.special_requests,
    r.sms_updates_consent,r.booking_status,r.lumen_booking_code,h.display_name AS hotel_name,h.public_email,
    s.booking_notification_email,COALESCE(s.guest_email_enabled,1) AS guest_email_enabled,
    COALESCE(s.guest_sms_enabled,0) AS guest_sms_enabled
    FROM reservation_notification_jobs n
    JOIN reservations r ON r.id=n.reservation_id
    JOIN hotels h ON h.id=n.hotel_id AND h.status='active' AND h.archived_at IS NULL
    LEFT JOIN hotel_reservation_settings s ON s.hotel_id=n.hotel_id
    WHERE n.reservation_id=? AND n.hotel_id='crystal-inn-northwest-290'
      AND n.channel IN ('property_request_email','guest_request_email','guest_request_sms','guest_confirmed_email','guest_confirmed_sms')`)
   .bind(reservationId).all<Job>();
  jobs=data.results;
 }catch{return output}
 if(purpose==='confirmed' && jobs.some(j=>j.booking_status!=='confirmed'||!j.lumen_booking_code))return output;
 const apiKey=envText(e,'RESEND_API_KEY'),from=envText(e,'RESERVATION_FROM_EMAIL');
 const emailReady=Boolean(apiKey&&emailValid(from));
 const account=envText(e,'TWILIO_ACCOUNT_SID'),apiSid=envText(e,'TWILIO_API_KEY'),apiSecret=envText(e,'TWILIO_API_SECRET');
 const service=envText(e,'TWILIO_MESSAGING_SERVICE_SID');
 const smsEnabled=e.RESERVATION_SMS_ENABLED===true||envText(e,'RESERVATION_SMS_ENABLED').toLowerCase()==='true';
 const smsReady=smsEnabled&&/^AC[0-9a-f]{32}$/i.test(account)&&/^MG[0-9a-f]{32}$/i.test(service)&&Boolean(apiSid&&apiSecret);
 for(const channel of channels){
  const job=jobs.find(j=>j.channel===channel);
  if(!job)continue;
  const key=channel==='property_request_email'?'propertyEmail':channel.includes('email')?'guestEmail':'guestSms';
  if(job.state==='accepted'){output[key]='accepted';continue}
  const emailDestination=channel==='property_request_email'
    ?(job.booking_notification_email||job.public_email||''):job.email;
  if(channel==='guest_request_sms'||channel==='guest_confirmed_sms'){
   if(!job.sms_updates_consent||!job.guest_sms_enabled){output.guestSms='not_requested';continue}
   output.guestSms='pending';
   if(!smsReady||!/^\+1[2-9]\d{2}[2-9]\d{6}$/.test(job.phone_e164))continue;
  }else{
   if(channel!=='property_request_email'&&!job.guest_email_enabled){output.guestEmail='not_requested';continue}
   if(!emailReady||!emailDestination||!emailValid(emailDestination))continue;
  }
  // An atomic claim avoids two web requests sending the same job.
  let claimed:{id:string}|null;
  try{
   claimed=await db.prepare(`UPDATE reservation_notification_jobs
    SET state='processing',attempts=attempts+1,last_attempt_at=CURRENT_TIMESTAMP,error_code=NULL
    WHERE id=? AND state IN ('pending','failed') AND attempts<3 RETURNING id`).bind(job.id).first<{id:string}>();
  }catch{continue}
  if(!claimed)continue;
  let ok=false,providerId='',errorCode='network_error';
  try{
   if(channel==='guest_request_sms'){
    const params=new URLSearchParams({To:job.phone_e164,MessagingServiceSid:service,Body:purpose==='confirmed'?confirmedSms(job):reservationSms(job)});
    const response=await fetch('https://api.twilio.com/2010-04-01/Accounts/'+account+'/Messages.json',{
     method:'POST',headers:{Authorization:'Basic '+Buffer.from(apiSid+':'+apiSecret).toString('base64'),
      'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},
     body:params.toString(),redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(8000)
    });
    if(response.ok){
     const payload=await response.json() as {sid?:string,status?:string};
     ok=typeof payload.sid==='string'&&/^(SM|MM)[0-9a-f]{32}$/i.test(payload.sid);
     providerId=ok?payload.sid||'':'';
    }
    errorCode='twilio_http_'+response.status;
   }else{
    const text=purpose==='confirmed'?confirmedEmail(job):reservationText(job,channel==='property_request_email');
    const response=await fetch('https://api.resend.com/emails',{
     method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json',
      'Idempotency-Key':job.id},
     body:JSON.stringify({
      from,to:[emailDestination],
      subject:(purpose==='confirmed'?'Reservation CONFIRMED ':channel==='property_request_email'?'NEW stay REQUEST ':'Stay request RECEIVED ')+job.reference+' — '+job.hotel_name,
      text,html:'<div style="font-family:Arial,sans-serif;white-space:pre-line">'+xml(text)+'</div>',
      ...(channel==='property_request_email'&&emailValid(job.email)?{reply_to:job.email}:{})
     }),
     redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(8000)
    });
    if(response.ok){const payload=await response.json() as {id?:string};ok=Boolean(payload.id);providerId=payload.id||'';}
    errorCode='resend_http_'+response.status;
   }
  }catch{errorCode='network_error'}
  try{
   await db.prepare(`UPDATE reservation_notification_jobs SET state=?,provider_id=?,error_code=?,
    accepted_at=CASE WHEN ?='accepted' THEN CURRENT_TIMESTAMP ELSE NULL END
    WHERE id=? AND state='processing'`)
    .bind(ok?'accepted':'failed',providerId||null,ok?null:safelyError(errorCode),ok?'accepted':'failed',job.id).run();
   output[key]=ok?'accepted':'failed';
  }catch{
   // On uncertain provider acceptance, leave processing to prevent automatic
   // Twilio SMS duplicates. A developer must reconcile this record manually.
   output[key]='pending';
  }
 }
 return output;
}
