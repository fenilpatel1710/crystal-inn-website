import {NextRequest,NextResponse} from 'next/server';
import {environment,noStore} from '../../../../../lib/platform/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
const nw={id:'crystal-inn-northwest-290',slug:'northwest-290',display_name:'Crystal Inn Northwest 290',city:'Houston',region:'TX',description:'Enjoy comfortable rooms and friendly service in Northwest Houston.',public_phone:'713-993-6567',hero_image_url:null,is_legacy_booking:true};
export async function GET(_req:NextRequest,{params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>64)return NextResponse.json({error:'Not found'},{status:404,headers:noStore});
 try{
 const e=environment();if(!e.db)throw Error('No DB');
 const hotel=await e.db.prepare(`SELECT id,slug,display_name,city,region,description,public_phone,public_email,address_text,hero_image_url FROM hotels WHERE slug=? AND status='active'`).bind(slug).first<Record<string,unknown>>();
 if(hotel){
 const rooms=await e.db.prepare(`SELECT id,display_name,description FROM hotel_room_types WHERE hotel_id=? AND is_active=1 ORDER BY display_name`).bind(hotel.id as string).all();
 return NextResponse.json({hotel:{...hotel,is_legacy_booking:slug==='northwest-290'},rooms:rooms.results},{headers:noStore});
 }
 }catch{}
 if(slug==='northwest-290')return NextResponse.json({hotel:nw,rooms:[],setupPending:true},{headers:noStore});
 return NextResponse.json({error:'Hotel not found.'},{status:404,headers:noStore});
}
