import {NextRequest,NextResponse} from 'next/server';
import {authorize,noStore} from '../../../../lib/platform/auth';
import {dispatchReservationNotifications} from '../../../../lib/reservation-notifications';
import {getCloudflareContext} from '@opennextjs/cloudflare';
export const runtime='nodejs';export const dynamic='force-dynamic';
const PILOT='crystal-inn-northwest-290';
const validEmail=(s:string)=>!s||s.length<=190&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
function providerState(){
 const e=getCloudflareContext().env as unknown as Record<string,unknown>;
 const str=(name:string)=>typeof e[name]==='string'?(e[name] as string).trim():'';
 return {
  email:Boolean(str('RESEND_API_KEY')&&str('RESERVATION_FROM_EMAIL')),
  sms:Boolean((e.RESERVATION_SMS_ENABLED===true||str('RESERVATION_SMS_ENABLED').toLowerCase()==='true')
   &&/^AC[0-9a-f]{32}$/i.test(str('TWILIO_ACCOUNT_SID'))
   &&/^MG[0-9a-f]{32}$/i.test(str('TWILIO_MESSAGING_SERVICE_SID'))
   &&str('TWILIO_API_KEY')&&str('TWILIO_API_SECRET'))
 };
}
export async function GET(req:NextRequest){
 const a=await authorize(req,'hotel');if(a instanceof NextResponse)return a;
 if(!a.hotelId)return NextResponse.json({error:'Hotel access required.'},{status:403,headers:noStore});
 try{
  const [h,pending]=await Promise.all([
   a.db.prepare(`SELECT h.public_email,s.booking_notification_email,
    COALESCE(s.guest_email_enabled,1) AS guest_email_enabled,
    COALESCE(s.guest_sms_enabled,0) AS guest_sms_enabled
    FROM hotels h LEFT JOIN hotel_reservation_settings s ON s.hotel_id=h.id WHERE h.id=?`)
    .bind(a.hotelId).first<{public_email:string|null;booking_notification_email:string|null;guest_email_enabled:number;guest_sms_enabled:number}>(),
   a.db.prepare(`SELECT n.channel,n.state,COUNT(*) AS total FROM reservation_notification_jobs n
    WHERE n.hotel_id=? GROUP BY n.channel,n.state`).bind(a.hotelId).all<{channel:string;state:string;total:number}>()
  ]);
  return NextResponse.json({supported:a.hotelId===PILOT,
   publicEmail:h?.public_email||'',bookingNotificationEmail:h?.booking_notification_email||'',
   guestEmailEnabled:!!h?.guest_email_enabled,guestSmsEnabled:!!h?.guest_sms_enabled,
   providers:providerState(),deliverySummary:pending.results},{headers:noStore});
 }catch{return NextResponse.json({error:'Reservation notification settings unavailable. Apply migration 0012.'},{status:503,headers:noStore})}
}
export async function PUT(req:NextRequest){
 const a=await authorize(req,'hotel');if(a instanceof NextResponse)return a;
 if(!a.hotelId)return NextResponse.json({error:'Hotel access required.'},{status:403,headers:noStore});
 let b:Record<string,unknown>;try{b=await req.json()}catch{return NextResponse.json({error:'Invalid settings.'},{status:400,headers:noStore})}
 const bookingEmail=typeof b.bookingNotificationEmail==='string'?b.bookingNotificationEmail.trim():'';
 if(!validEmail(bookingEmail)||typeof b.guestEmailEnabled!=='boolean'||typeof b.guestSmsEnabled!=='boolean')
  return NextResponse.json({error:'Enter a valid property email and choose notification settings.'},{status:400,headers:noStore});
 try{
  const h=await a.db.prepare('SELECT public_email FROM hotels WHERE id=?')
   .bind(a.hotelId).first<{public_email:string|null}>();
  if(!h||!validEmail(h.public_email||''))return NextResponse.json({error:'Hotel public email is invalid.'},{status:400,headers:noStore});
  if(!(bookingEmail||h.public_email))return NextResponse.json({error:'Set a reservation notification email or a hotel public email.'},{status:400,headers:noStore});
  await a.db.prepare(`INSERT INTO hotel_reservation_settings
   (hotel_id,booking_notification_email,guest_email_enabled,guest_sms_enabled) VALUES (?,?,?,?)
   ON CONFLICT(hotel_id) DO UPDATE SET
    booking_notification_email=excluded.booking_notification_email,
    guest_email_enabled=excluded.guest_email_enabled,
    guest_sms_enabled=excluded.guest_sms_enabled,updated_at=CURRENT_TIMESTAMP`)
   .bind(a.hotelId,bookingEmail||null,b.guestEmailEnabled?1:0,b.guestSmsEnabled?1:0).run();
  return NextResponse.json({ok:true},{headers:noStore});
 }catch{return NextResponse.json({error:'Unable to save notification settings. Apply migration 0012.'},{status:503,headers:noStore})}
}
export async function POST(req:NextRequest){
 const a=await authorize(req,'hotel');if(a instanceof NextResponse)return a;
 if(a.hotelId!==PILOT)return NextResponse.json({error:'Reservation notifications are not enabled for this property.'},{status:403,headers:noStore});
 let data:{reference?:unknown};try{data=await req.json()}catch{return NextResponse.json({error:'Invalid request.'},{status:400,headers:noStore})}
 const ref=typeof data.reference==='string'?data.reference:'';
 if(!/^CI-[0-9A-F]{12}$/.test(ref))return NextResponse.json({error:'Enter a valid booking request reference.'},{status:400,headers:noStore});
 try{
  const r=await a.db.prepare('SELECT id FROM reservations WHERE public_reference=?').bind(ref).first<{id:string}>();
  if(!r)return NextResponse.json({error:'Request reference not found for this property.'},{status:404,headers:noStore});
  const result=await dispatchReservationNotifications(a.db,r.id);
  return NextResponse.json({ok:true,reference:ref,delivery:result,
   note:'Accepted means provider accepted the message, not that the guest received it.'},{headers:noStore});
 }catch{return NextResponse.json({error:'Could not retry pending notifications.'},{status:503,headers:noStore})}
}
