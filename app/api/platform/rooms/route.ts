import {NextRequest,NextResponse} from 'next/server';
import {authorize,noStore} from '../../../../lib/platform/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
function validImage(v:string){if(!v)return true;if(v.length>1000)return false;try{const url=new URL(v);return url.protocol==='https:'&&!url.username&&!url.password}catch{return false}}
function input(b:Record<string,unknown>){
 const hotelId=String(b.hotelId||''),id=String(b.id||''),name=String(b.name||'').trim(),description=String(b.description||'').trim(),imageUrl=String(b.imageUrl||'').trim();
 const raw=b.startingRate;
 const rate=raw===null||raw===undefined||raw===''?null:Number(raw);
 const startingRateCents=rate===null?null:Math.round(rate*100);
 const rateValid=rate===null||(Number.isFinite(rate)&&rate>=0&&rate<=1000000&&Number.isInteger(rate*100));
 return {hotelId,id,name,description,imageUrl,isActive:b.isActive===false?0:1,startingRateCents,rateValid};
}
export async function GET(req:NextRequest){
 const a=await authorize(req,'platform');if(a instanceof NextResponse)return a;
 const hotelId=new URL(req.url).searchParams.get('hotelId')||'';
 if(!hotelId||hotelId.length>120)return NextResponse.json({error:'Select a hotel.'},{status:400,headers:noStore});
 try{
 const rooms=await a.db.prepare('SELECT id,hotel_id,display_name,description,image_url,is_active,starting_rate_cents FROM hotel_room_types WHERE hotel_id=? ORDER BY display_name').bind(hotelId).all();
 return NextResponse.json({rooms:rooms.results},{headers:noStore});
 }catch{return NextResponse.json({error:'Unable to load room categories.'},{status:503,headers:noStore})}
}
export async function POST(req:NextRequest){
 const a=await authorize(req,'platform');if(a instanceof NextResponse)return a;
 let b:Record<string,unknown>;try{b=await req.json()}catch{return NextResponse.json({error:'Invalid JSON.'},{status:400,headers:noStore})}
 if(b.action==='seed_northwest_room_names'){
 const id='crystal-inn-northwest-290';
 const verifiedNames=['King Non-Smoking','King Smoking','Queen Non-Smoking'];
 try{
  const hotel=await a.db.prepare('SELECT id FROM hotels WHERE id=? AND archived_at IS NULL').bind(id).first();
  if(!hotel)return NextResponse.json({error:'Northwest 290 not found or archived.'},{status:404,headers:noStore});
  const old=await a.db.prepare('SELECT display_name FROM hotel_room_types WHERE hotel_id=?').bind(id).all<{display_name:string}>();
  const names=new Set(old.results.map(x=>x.display_name.trim().toLowerCase()));
  let created=0;
  for(const name of verifiedNames){
   if(names.has(name.toLowerCase()))continue;
   await a.db.prepare('INSERT INTO hotel_room_types(id,hotel_id,display_name,description,is_active) VALUES(?,?,?,?,1)').bind(crypto.randomUUID(),id,name,'').run();
   created++;
  }
  await a.db.prepare('INSERT INTO platform_admin_audit(id,actor_email,action,hotel_id,details) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),a.email,'seed_verified_northwest_room_names',id,String(created)+' room names added').run();
  return NextResponse.json({ok:true,created},{headers:noStore});
 }catch{return NextResponse.json({error:'Unable to add Northwest 290 room names.'},{status:503,headers:noStore})}
 }
 const x=input(b);
 if(!x.hotelId||x.hotelId.length>120||x.name.length<3||x.name.length>90||x.description.length>2000||!validImage(x.imageUrl)||!x.rateValid)return NextResponse.json({error:'Enter a valid hotel, room name, description, and optional HTTPS image URL.'},{status:400,headers:noStore});
 try{
 const hotel=await a.db.prepare('SELECT id FROM hotels WHERE id=? AND archived_at IS NULL').bind(x.hotelId).first();
 if(!hotel)return NextResponse.json({error:'Hotel not found or archived.'},{status:404,headers:noStore});
 await a.db.batch([
 a.db.prepare('INSERT INTO hotel_room_types(id,hotel_id,display_name,description,image_url,is_active,starting_rate_cents) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),x.hotelId,x.name,x.description,x.imageUrl||null,x.isActive,x.startingRateCents),
 a.db.prepare('INSERT INTO platform_admin_audit(id,actor_email,action,hotel_id,details) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),a.email,'create_room_category',x.hotelId,x.name)
 ]);
 return NextResponse.json({ok:true},{headers:noStore});
 }catch{return NextResponse.json({error:'Room could not be created. Check for a duplicate name.'},{status:409,headers:noStore})}
}
export async function PUT(req:NextRequest){
 const a=await authorize(req,'platform');if(a instanceof NextResponse)return a;
 let b:Record<string,unknown>;try{b=await req.json()}catch{return NextResponse.json({error:'Invalid JSON.'},{status:400,headers:noStore})}
 const x=input(b);
 if(!x.hotelId||x.hotelId.length>120||x.id.length<8||x.id.length>120||x.name.length<3||x.name.length>90||x.description.length>2000||!validImage(x.imageUrl))return NextResponse.json({error:'Invalid room details.'},{status:400,headers:noStore});
 try{
 const room=await a.db.prepare('SELECT id FROM hotel_room_types WHERE id=? AND hotel_id=?').bind(x.id,x.hotelId).first();
 if(!room)return NextResponse.json({error:'Room not found in this hotel.'},{status:404,headers:noStore});
 await a.db.batch([
 a.db.prepare('UPDATE hotel_room_types SET display_name=?,description=?,image_url=?,is_active=?,starting_rate_cents=? WHERE id=? AND hotel_id=?').bind(x.name,x.description,x.imageUrl||null,x.isActive,x.startingRateCents,x.id,x.hotelId),
 a.db.prepare('INSERT INTO platform_admin_audit(id,actor_email,action,hotel_id,details) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),a.email,'update_room_category',x.hotelId,x.id)
 ]);
 return NextResponse.json({ok:true},{headers:noStore});
 }catch{return NextResponse.json({error:'Could not save room category.'},{status:503,headers:noStore})}
}
