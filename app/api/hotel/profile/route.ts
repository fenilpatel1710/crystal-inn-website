import {NextRequest,NextResponse} from 'next/server';
import {authorize,noStore} from '../../../../lib/platform/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const a=await authorize(req,'hotel');if(a instanceof NextResponse)return a;
 try{
 const hotel=await a.db.prepare(`SELECT id,slug,display_name,city,region,description,public_phone,public_email,address_text,hero_image_url
 FROM hotels WHERE id=?`).bind(a.hotelId).first();
 return NextResponse.json({hotel},{headers:noStore});
 }catch{return NextResponse.json({error:'Hotel profile unavailable.'},{status:503,headers:noStore})}
}
export async function PUT(req:NextRequest){
 const a=await authorize(req,'hotel');if(a instanceof NextResponse)return a;
 let b:Record<string,unknown>;try{b=await req.json()}catch{return NextResponse.json({error:'Invalid input.'},{status:400,headers:noStore})}
 const description=String(b.description||'').trim(),phone=String(b.publicPhone||'').trim(),email=String(b.publicEmail||'').trim(),address=String(b.address||'').trim();
 if(description.length>1800||phone.length>32||address.length>250||email.length>190||(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))
 return NextResponse.json({error:'Invalid hotel contact information.'},{status:400,headers:noStore});
 try{
 await a.db.prepare(`UPDATE hotels SET description=?,public_phone=?,public_email=?,address_text=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
 .bind(description,phone||null,email||null,address||null,a.hotelId).run();
 return NextResponse.json({ok:true},{headers:noStore})
 }catch{return NextResponse.json({error:'Unable to update hotel profile.'},{status:503,headers:noStore})}
}
