import {NextRequest,NextResponse} from 'next/server';
import {authorize,noStore} from '../../../../../lib/platform/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const a=await authorize(req,'platform');if(a instanceof NextResponse)return a;
 const id=new URL(req.url).searchParams.get('id')||'';
 if(!id||id.length>120)return NextResponse.json({error:'Invalid hotel.'},{status:400,headers:noStore});
 try{const hotel=await a.db.prepare(`SELECT id,slug,display_name,city,region,timezone,public_phone,public_email,address_text,description,hero_image_url,
 lumen_hotel_id,subscription_status,subscription_amount_cents,subscription_renewal_date,status,archived_at FROM hotels WHERE id=?`).bind(id).first();
 if(!hotel)return NextResponse.json({error:'Hotel not found.'},{status:404,headers:noStore});
 return NextResponse.json({hotel},{headers:noStore})}catch{return NextResponse.json({error:'Hotel profile unavailable. Apply D1 migration 0005.'},{status:503,headers:noStore})}
}
export async function PUT(req:NextRequest){
 const a=await authorize(req,'platform');if(a instanceof NextResponse)return a;
 let b:Record<string,unknown>;try{b=await req.json()}catch{return NextResponse.json({error:'Invalid input.'},{status:400,headers:noStore})}
 const id=String(b.hotelId||''),name=String(b.name||'').trim(),city=String(b.city||'').trim(),region=String(b.region||'').trim().toUpperCase(),
 phone=String(b.phone||'').trim(),email=String(b.email||'').trim(),address=String(b.address||'').trim(),
 description=String(b.description||'').trim(),image=String(b.image||'').trim();
 const rawId=b.lumenHotelId;
 const lumenId=rawId===null||rawId===undefined||rawId===''?null:Number(rawId);
 if(!id||id.length>120||name.length<3||name.length>100||city.length<2||city.length>80||!/^[A-Z]{2}$/.test(region)||
 phone.length>32||email.length>190||(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))||address.length>250||
 description.length>1800||image.length>1000||(image&&!/^https:\/\/[^\s]+$/.test(image))||
 (lumenId!==null&&(!Number.isSafeInteger(lumenId)||lumenId<1||lumenId>2147483647)))
 return NextResponse.json({error:'Invalid hotel information or Lumen Hotel ID.'},{status:400,headers:noStore});
 try{
 const original=await a.db.prepare('SELECT id,archived_at,hero_image_url FROM hotels WHERE id=?').bind(id).first<{id:string;archived_at:string|null;hero_image_url:string|null}>();
 if(!original)return NextResponse.json({error:'Hotel not found.'},{status:404,headers:noStore});
 await a.db.batch([
 a.db.prepare(`UPDATE hotels SET display_name=?,city=?,region=?,public_phone=?,public_email=?,address_text=?,description=?,
 hero_image_url=?,lumen_hotel_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
 .bind(name,city,region,phone||null,email||null,address||null,description,image||(original.hero_image_url?.startsWith('r2:')?original.hero_image_url:null),lumenId,id),
 a.db.prepare('INSERT INTO platform_admin_audit(id,actor_email,action,hotel_id) VALUES(?,?,?,?)')
 .bind(crypto.randomUUID(),a.email,'edit_hotel_profile',id)
 ]);
 return NextResponse.json({ok:true},{headers:noStore});
 }catch{return NextResponse.json({error:'Could not save hotel profile. Check migration 0005.'},{status:503,headers:noStore})}
}
