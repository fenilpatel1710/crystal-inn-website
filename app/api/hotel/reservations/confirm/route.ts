/**
 * Staff-only manual PMS booking attestation, NW290 legacy request flow.
 * Does not create a booking in Lumen and never accepts guest/public calls.
 */
import {NextRequest,NextResponse} from 'next/server';
import {authorize,noStore} from '../../../../../lib/platform/auth';
import {dispatchReservationNotifications} from '../../../../../lib/reservation-notifications';
export const runtime='nodejs';export const dynamic='force-dynamic';
const HOTEL='crystal-inn-northwest-290';
export async function POST(req:NextRequest){
 const auth=await authorize(req,'hotel');if(auth instanceof NextResponse)return auth;
 if(auth.hotelId!==HOTEL)return NextResponse.json({error:'Manual PMS confirmation is not enabled for this property.'},{status:403,headers:noStore});
 if(Number(req.headers.get('content-length')||0)>1600)return NextResponse.json({error:'Invalid request.'},{status:400,headers:noStore});
 let b:Record<string,unknown>;try{b=await req.json()}catch{return NextResponse.json({error:'Invalid request.'},{status:400,headers:noStore})}
 const reference=typeof b.reference==='string'?b.reference.trim().toUpperCase():'';
 const lumenCode=typeof b.lumenBookingReference==='string'?b.lumenBookingReference.trim():'';
 if(!/^CI-[0-9A-F]{12}$/.test(reference)||!/^[A-Za-z0-9][A-Za-z0-9_./-]{2,79}$/.test(lumenCode)||b.confirmedInPms!==true)
  return NextResponse.json({error:'Enter the website reference, actual Lumen booking reference, and explicitly attest that the correct PMS database shows the booking as confirmed.'},{status:400,headers:noStore});
 try{
  const row=await auth.db.prepare('SELECT id,booking_status,sms_updates_consent,lumen_booking_code FROM reservations WHERE public_reference=?')
   .bind(reference).first<{id:string;booking_status:string;sms_updates_consent:number;lumen_booking_code:string|null}>();
  if(!row)return NextResponse.json({error:'Northwest 290 stay request not found.'},{status:404,headers:noStore});
  if(row.booking_status==='confirmed'&&row.lumen_booking_code!==lumenCode)
   return NextResponse.json({error:'This website reference is already confirmed with a different PMS booking reference. Contact the platform administrator.'},{status:409,headers:noStore});
  if(!['request_received','pending_review','confirmed'].includes(row.booking_status))
   return NextResponse.json({error:'A cancelled or rejected request cannot be manually confirmed.'},{status:409,headers:noStore});
  if(row.booking_status!=='confirmed'){
   // D1 batch is atomic: state transition and delivery intentions go together.
   const ops=[
    auth.db.prepare(`UPDATE reservations SET booking_status='confirmed',
      lumen_booking_code=?,lumen_sync_status='manual_review',
      confirmed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
      WHERE id=? AND booking_status IN ('request_received','pending_review')`)
     .bind(lumenCode,row.id),
    auth.db.prepare(`INSERT OR IGNORE INTO reservation_notification_jobs
      (id,reservation_id,hotel_id,channel)
      SELECT ?,id,?,'guest_confirmed_email' FROM reservations
      WHERE id=? AND booking_status='confirmed'`)
     .bind(crypto.randomUUID(),HOTEL,row.id),
    auth.db.prepare(`INSERT INTO reservation_audit_log
      (id,reservation_id,action,actor_type,actor_id,details_json)
      SELECT ?,id,'manual_lumen_booking_confirmed','staff',?,?
      FROM reservations WHERE id=? AND booking_status='confirmed'`)
     .bind(crypto.randomUUID(),auth.email,JSON.stringify({lumenBookingReference:lumenCode,method:'staff_attestation'}),row.id)
   ];
   if(row.sms_updates_consent){
    ops.push(auth.db.prepare(`INSERT OR IGNORE INTO reservation_notification_jobs
     (id,reservation_id,hotel_id,channel)
     SELECT ?,id,?,'guest_confirmed_sms' FROM reservations
     WHERE id=? AND booking_status='confirmed'`)
     .bind(crypto.randomUUID(),HOTEL,row.id));
   }
   await auth.db.batch(ops);
  }
  const latest=await auth.db.prepare('SELECT booking_status,lumen_booking_code FROM reservations WHERE id=?')
   .bind(row.id).first<{booking_status:string;lumen_booking_code:string|null}>();
  if(latest?.booking_status!=='confirmed'||latest.lumen_booking_code!==lumenCode)
   return NextResponse.json({error:'Could not confirm this request. Review PMS and website status.'},{status:409,headers:noStore});
  const delivery=await dispatchReservationNotifications(auth.db,row.id,'confirmed');
  return NextResponse.json({ok:true,reference,status:'confirmed',confirmationSource:'staff_verified_in_lumen',
   delivery,note:'Confirmed via property staff attestation. Message provider acceptance is not proof of actual delivery.'},{headers:noStore});
 }catch{return NextResponse.json({error:'Manual confirmation unavailable. Verify migration 0012 and booking record.'},{status:503,headers:noStore})}
}
