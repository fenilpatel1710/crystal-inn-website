import {NextRequest,NextResponse} from 'next/server';
import {authorize,noStore} from '../../../../lib/platform/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const a=await authorize(req,'hotel');if(a instanceof NextResponse)return a;
 try{
 const hotel=await a.db.prepare('SELECT id,display_name,slug,city,region,status FROM hotels WHERE id=?').bind(a.hotelId).first();
 const rooms=await a.db.prepare('SELECT id,display_name,description,is_active FROM hotel_room_types WHERE hotel_id=? ORDER BY display_name').bind(a.hotelId).all();
 const reservations=await a.db.prepare(`SELECT reference,guest_name,check_in,check_out,rooms_count,status,created_at
 FROM hotel_reservations WHERE hotel_id=? ORDER BY created_at DESC LIMIT 100`).bind(a.hotelId).all();
 return NextResponse.json({hotel,rooms:rooms.results,reservations:reservations.results,email:a.email},{headers:noStore});
 }catch{return NextResponse.json({error:'Hotel database not initialized.'},{status:503,headers:noStore})}
}
