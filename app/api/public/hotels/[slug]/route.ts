import {NextRequest,NextResponse} from 'next/server';
import {environment,noStore} from '../../../../../lib/platform/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(_req:NextRequest,{params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>64)return NextResponse.json({error:'Not found'},{status:404,headers:noStore});
 try{
 const e=environment();if(!e.db)throw Error('No DB');
 const hotel=await e.db.prepare(`SELECT id,slug,display_name,city,region,description,public_phone,public_email,address_text,hero_image_url,rewards_enabled FROM hotels WHERE slug=? AND status='active' AND archived_at IS NULL`).bind(slug).first<Record<string,unknown>>();
 if(hotel){
 const rooms=await e.db.prepare(`SELECT id,display_name,description,image_url FROM hotel_room_types WHERE hotel_id=? AND is_active=1 ORDER BY display_name`).bind(hotel.id as string).all();
 return NextResponse.json({hotel:{...hotel,hero_image_url:typeof hotel.hero_image_url==='string'&&hotel.hero_image_url.startsWith('r2:')?'/api/public/media?hotel='+encodeURIComponent(hotel.id as string):hotel.hero_image_url,is_legacy_booking:slug==='northwest-290'},rooms:rooms.results},{headers:noStore});
 }
 }catch{return NextResponse.json({error:'Hotel directory temporarily unavailable.'},{status:503,headers:noStore})}
 return NextResponse.json({error:'Hotel not found.'},{status:404,headers:noStore});
}
