import {NextRequest,NextResponse} from 'next/server';
import {authorize,noStore} from '../../../../lib/platform/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const a=await authorize(req,'hotel');if(a instanceof NextResponse)return a;
 try{
  const reviews=await a.db.prepare(`SELECT id,rating,review_text,status,created_at,updated_at
   FROM hotel_guest_reviews WHERE hotel_id=? ORDER BY created_at DESC LIMIT 200`)
   .bind(a.hotelId).all();
  return NextResponse.json({reviews:reviews.results},{headers:noStore});
 }catch{return NextResponse.json({error:'Review management unavailable. Apply migration 0011.'},{status:503,headers:noStore})}
}
export async function PATCH(req:NextRequest){
 const a=await authorize(req,'hotel');if(a instanceof NextResponse)return a;
 let b:Record<string,unknown>;try{b=await req.json()}catch{return NextResponse.json({error:'Invalid request.'},{status:400,headers:noStore})}
 const id=typeof b.id==='string'?b.id:'',status=b.status;
 if(!/^[0-9a-f-]{36}$/i.test(id)||!['published','hidden'].includes(String(status)))
  return NextResponse.json({error:'Invalid review or moderation action.'},{status:400,headers:noStore});
 try{
  const row=await a.db.prepare('SELECT id FROM hotel_guest_reviews WHERE id=? AND hotel_id=?')
   .bind(id,a.hotelId).first();
  if(!row)return NextResponse.json({error:'Review not found in your property.'},{status:404,headers:noStore});
  await a.db.prepare('UPDATE hotel_guest_reviews SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND hotel_id=?')
   .bind(String(status),id,a.hotelId).run();
  return NextResponse.json({ok:true},{headers:noStore});
 }catch{return NextResponse.json({error:'Unable to moderate review.'},{status:503,headers:noStore})}
}
