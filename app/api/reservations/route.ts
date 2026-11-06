import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextRequest, NextResponse } from 'next/server';
import {guestSession} from '../../../lib/guest/auth';
import {dispatchReservationNotifications} from '../../../lib/reservation-notifications';
import type {DB} from '../../../lib/admin/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const allowedRoomTypes = new Set(['King Non-Smoking', 'King Smoking', 'Queen Non-Smoking', 'No preference']);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const noStore = {'Cache-Control': 'no-store'};
const PILOT_HOTEL_ID = 'crystal-inn-northwest-290';
function usPhoneE164(phone:string) {
  const digits=phone.replace(/\D/g,'');
  if(digits.length===10) return '+1'+digits;
  if(digits.length===11&&digits.startsWith('1')) return '+'+digits;
  return '';
}
function validDate(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s+'T12:00:00Z');
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0,10) === s;
}

export async function POST(request: NextRequest) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 12000) return NextResponse.json({error:'Request too large.'}, {status:413});
  let input: Record<string,unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 12000) throw Error('large');
    input = JSON.parse(raw);
    if (!input || Array.isArray(input) || typeof input !== 'object') throw Error('bad');
  } catch { return NextResponse.json({error:'Invalid request.'}, {status:400}); }
  if (text(input.website,100)) return NextResponse.json({error:'Unable to submit request.'}, {status:400});
  const v = {
    checkIn:text(input.checkIn,10), checkOut:text(input.checkOut,10), roomType:text(input.roomType,35),
    rooms:Number(input.rooms), guests:Number(input.guests), firstName:text(input.firstName,70),
    lastName:text(input.lastName,70), phone:text(input.phone,30), email:text(input.email,160),
    notes:text(input.notes,600),smsUpdatesConsent:input.smsUpdatesConsent===true
  };
  // Derive hotel-local calendar date without depending on locale-specific order.
  const chicagoParts = new Intl.DateTimeFormat('en-US', {
    timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(new Date());
  const part=(name:string)=>chicagoParts.find(p=>p.type===name)?.value||'';
  const today = part('year')+'-'+part('month')+'-'+part('day');
  const nights = (Date.parse(v.checkOut+'T12:00:00Z')-Date.parse(v.checkIn+'T12:00:00Z'))/86400000;
  const invalid=(error:string)=>NextResponse.json({error},{status:400,headers:noStore});
  if(!validDate(v.checkIn)||!validDate(v.checkOut)) return invalid('Enter valid check-in and check-out dates.');
  if(v.checkIn<today) return invalid('Choose a future check-in date.');
  if(!Number.isFinite(nights)||nights<1||nights>30) return invalid('Select a stay of 1 to 30 nights, with check-out after check-in.');
  if(!allowedRoomTypes.has(v.roomType)) return invalid('Select one of the available room types.');
  if(!Number.isInteger(v.rooms)||v.rooms<1||v.rooms>4) return invalid('Select 1 to 4 rooms.');
  if(!Number.isInteger(v.guests)||v.guests<1||v.guests>8) return invalid('Select 1 to 8 guests.');
  if(!v.firstName||!v.lastName) return invalid('Enter your first and last name.');
  if(!emailPattern.test(v.email)) return invalid('Enter a valid email address.');
  if(!/^\+1[2-9]\d{2}[2-9]\d{6}$/.test(usPhoneE164(v.phone))) return invalid('Enter a valid US phone number with area code.');

  let db: DB;
  try {
    const context = getCloudflareContext();
    const env = context.env as typeof context.env & {DB?: DB};
    if (!env.DB) throw Error('DB binding not present');
    db = env.DB;
  } catch {
    console.error('Reservation storage unavailable');
    return NextResponse.json({error:'We cannot store requests right now. Please call 713-993-6567.'},{status:503});
  }

  // Never link an unverified reservation to an existing guest by phone alone.
  // OTP-authenticated reservation details may populate only that account's
  // hotel-scoped portal profile, not an unverified Lumen record.
  const session=await guestSession(request);
  const phoneE164=usPhoneE164(v.phone);
  const portalUserId=session?.hotel_id===PILOT_HOTEL_ID?session.user_id:null;
  if(portalUserId&&session?.phone_e164!==phoneE164){
    return NextResponse.json({error:'For your signed-in guest profile, use the mobile number you verified by SMS, or sign out to request for another guest.'},{status:400,headers:noStore});
  }

  // Prefer the canonical PMS name only when the portal/PMS link was separately
  // ownership-verified and a trusted PMS name snapshot exists. Never infer this
  // from phone number or a self-edited profile.
  let pmsName:{first_name:string;last_name:string}|null=null;
  if(portalUserId){
   try{
    pmsName=await db.prepare(`SELECT n.first_name,n.last_name FROM portal_guest_lumen_links l
      JOIN portal_guest_verified_pms_names n ON n.portal_user_id=l.portal_user_id
        AND n.hotel_id=l.hotel_id AND n.lumen_guest_id=l.lumen_guest_id
      WHERE l.portal_user_id=? AND l.hotel_id=? AND l.status='verified'
        AND l.revoked_at IS NULL LIMIT 1`)
      .bind(portalUserId,PILOT_HOTEL_ID).first<{first_name:string;last_name:string}>();
   }catch{
    return NextResponse.json({error:'Guest identity records are not ready. Apply migration 0012 and retry.'},{status:503,headers:noStore});
   }
  }
  if(pmsName){v.firstName=pmsName.first_name;v.lastName=pmsName.last_name}
  const nameSource=pmsName?'verified_pms':'guest_entered';

  // A browser-generated key allows safe retries after network interruptions.
  const rawKey = request.headers.get('X-Reservation-Request-Key') || '';
  const idempotencyKey = /^[0-9a-f-]{36}$/i.test(rawKey) ? rawKey : null;
  if (idempotencyKey) {
    try {
      const existing = await db.prepare('SELECT public_reference FROM reservations WHERE idempotency_key = ?').bind(idempotencyKey).first<{public_reference:string}>();
      if (existing) return NextResponse.json({reference:existing.public_reference,status:'Request already received — awaiting staff confirmation',notification:'not_verified'}, {status:200,headers:noStore});
    } catch { return NextResponse.json({error:'Unable to check request status. Please call 713-993-6567.'},{status:503}); }
  }

  const id = crypto.randomUUID();
  const reference = 'CI-'+crypto.randomUUID().replace(/-/g,'').slice(0,12).toUpperCase();
  try {
    // Reservation and independent notification intentions save together.
    const channels=['property_request_email','guest_request_email',
      ...(v.smsUpdatesConsent?['guest_request_sms']:[])];
    const writes=[
      db.prepare(`INSERT INTO reservations
        (id,public_reference,idempotency_key,first_name,last_name,phone_e164,email,room_type_label,
         check_in,check_out,rooms_count,guests_count,special_requests,booking_status,lumen_sync_status,
         sms_updates_consent,guest_name_source)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'request_received','not_started',?,?)`)
        .bind(id,reference,idempotencyKey,v.firstName,v.lastName,phoneE164,v.email,v.roomType,
              v.checkIn,v.checkOut,v.rooms,v.guests,v.notes || null,v.smsUpdatesConsent?1:0,nameSource),
      ...channels.map(channel=>db.prepare(`INSERT INTO reservation_notification_jobs
        (id,reservation_id,hotel_id,channel) VALUES (?,?,?,?)`)
        .bind(crypto.randomUUID(),id,PILOT_HOTEL_ID,channel)),
      db.prepare(`INSERT INTO reservation_audit_log (id,reservation_id,action,actor_type)
        VALUES (?,?,'request_received','guest')`).bind(crypto.randomUUID(),id)
    ];
    if(portalUserId){
      writes.push(
        db.prepare(`INSERT INTO portal_guest_profiles
          (portal_user_id,hotel_id,first_name,last_name,email)
          VALUES (?,?,?,?,?)
          ON CONFLICT(portal_user_id) DO UPDATE SET
          first_name=excluded.first_name,last_name=excluded.last_name,
          email=excluded.email,updated_at=CURRENT_TIMESTAMP`)
          .bind(portalUserId,PILOT_HOTEL_ID,v.firstName,v.lastName,v.email),
        db.prepare(`INSERT INTO portal_guest_reservation_links
          (reservation_id,portal_user_id,hotel_id) VALUES (?,?,?)`)
          .bind(id,portalUserId,PILOT_HOTEL_ID)
      );
    }
    await db.batch(writes);
  } catch {
    // In a rare race, an identical idempotency key can be inserted by another request.
    if (idempotencyKey) {
      try {
        const existing = await db.prepare('SELECT public_reference FROM reservations WHERE idempotency_key = ?').bind(idempotencyKey).first<{public_reference:string}>();
        if (existing) return NextResponse.json({reference:existing.public_reference,status:'Request already received — awaiting staff confirmation',notification:'not_verified'},{status:200,headers:noStore});
      } catch {}
    }
    console.error('Reservation persistence failed');
    return NextResponse.json({error:'Unable to save your request. Please call 713-993-6567.'},{status:503});
  }

  // Provider acceptance is best effort, durable outbox tracks each channel.
  // These are REQUEST RECEIVED notices — not room/price confirmations.
  const delivery=await dispatchReservationNotifications(db,id);
  return NextResponse.json({
    reference,
    status:'Request received — awaiting staff confirmation',
    notification:delivery.propertyEmail==='accepted'?'sent':'pending',
    delivery,
    message:delivery.propertyEmail!=='accepted'
      ?'Request saved, but front-desk email acceptance is not confirmed. Please call the hotel to follow up.'
      :undefined
  },{status:201,headers:noStore});
}
