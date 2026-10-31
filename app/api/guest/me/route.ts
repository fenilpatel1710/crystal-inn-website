import {NextRequest,NextResponse} from 'next/server';
import {guestSession,guestHeaders} from '../../../../lib/guest/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const guest=await guestSession(req);
 if(!guest)return NextResponse.json({authenticated:false},{headers:guestHeaders});
 // Do not return guest history, PMS guest IDs or rewards until independently linked.
 return NextResponse.json({authenticated:true,hotelId:guest.hotel_id,hotelName:guest.display_name,phone:guest.phone_e164,pmsConnected:false},{headers:guestHeaders});
}
