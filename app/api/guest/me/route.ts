import {NextRequest,NextResponse} from 'next/server';
import {guestSession,guestEnv,guestHeaders} from '../../../../lib/guest/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';

export async function GET(req:NextRequest){
 const guest=await guestSession(req);
 if(!guest)return NextResponse.json({authenticated:false},{headers:guestHeaders});
 const env=guestEnv();
 if(!env.db)return NextResponse.json({error:'Guest profile temporarily unavailable.'},{status:503,headers:guestHeaders});
 try{
  const [p,link]=await Promise.all([
   env.db.prepare('SELECT first_name,last_name,email FROM portal_guest_profiles WHERE portal_user_id=? AND hotel_id=?')
    .bind(guest.user_id,guest.hotel_id).first<{first_name:string;last_name:string;email:string}>(),
   env.db.prepare("SELECT id FROM portal_guest_lumen_links WHERE portal_user_id=? AND hotel_id=? AND status='verified' AND revoked_at IS NULL LIMIT 1")
    .bind(guest.user_id,guest.hotel_id).first<{id:string}>()
  ]);
  return NextResponse.json({
   authenticated:true,hotelId:guest.hotel_id,hotelName:guest.display_name,
   phone:guest.phone_e164,
   profile:p?{firstName:p.first_name,lastName:p.last_name,email:p.email}:null,
   existingPmsLinkVerified:Boolean(link),
   pmsConnected:false,
   governmentIdVerification:'at_front_desk'
  },{headers:guestHeaders});
 }catch{
  // Avoid exposing PMS or other guests' data when the new profile migration is pending.
  return NextResponse.json({
   authenticated:true,hotelId:guest.hotel_id,hotelName:guest.display_name,
   phone:guest.phone_e164,profile:null,profileSetupPending:true,
   existingPmsLinkVerified:false,pmsConnected:false,
   governmentIdVerification:'at_front_desk'
  },{headers:guestHeaders});
 }
}
