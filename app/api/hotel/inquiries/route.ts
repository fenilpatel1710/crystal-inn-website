import {NextRequest,NextResponse} from 'next/server';
import {authorize,noStore} from '../../../../lib/platform/auth';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(req:NextRequest){
 const a=await authorize(req,'hotel');
 if(a instanceof NextResponse)return a;
 if(!a.hotelId)return NextResponse.json({error:'Hotel access required.'},{status:403,headers:noStore});
 try{
  const inquiries=await a.db.prepare(`SELECT id,guest_name,email,phone,subject,message,status,created_at
   FROM guest_inquiries
   WHERE hotel_id=?
   ORDER BY created_at DESC LIMIT 100`).bind(a.hotelId).all();
  return NextResponse.json({inquiries:inquiries.results},{headers:noStore});
 }catch{return NextResponse.json({error:'Hotel inquiries unavailable. Verify D1 migration 0005.'},{status:503,headers:noStore})}
}
