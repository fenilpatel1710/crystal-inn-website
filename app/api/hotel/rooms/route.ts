import {NextRequest,NextResponse} from 'next/server';
import {authorize,noStore} from '../../../../lib/platform/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
function imageValid(v:string){if(!v)return true;if(v.length>1000)return false;try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password}catch{return false}}
export async function POST(req:NextRequest){
 const a=await authorize(req,'hotel');if(a instanceof NextResponse)return a;
 let b:Record<string,unknown>;try{b=await req.json()}catch{return NextResponse.json({error:'Invalid input'},{status:400,headers:noStore})}
 const name=String(b.name||'').trim(),description=String(b.description||'').trim(),imageUrl=String(b.imageUrl||'').trim();
 if(name.length<3||name.length>90||description.length>2000||!imageValid(imageUrl))return NextResponse.json({error:'Room name (3–90 characters) and description (up to 2000) required.'},{status:400,headers:noStore});
 try{
 await a.db.prepare('INSERT INTO hotel_room_types(id,hotel_id,display_name,description,image_url) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),a.hotelId,name,description,imageUrl||null).run();
 return NextResponse.json({ok:true},{headers:noStore})
 }catch{return NextResponse.json({error:'Unable to add room; name may already exist.'},{status:409,headers:noStore})}
}
export async function PUT(req:NextRequest){
 const a=await authorize(req,'hotel');if(a instanceof NextResponse)return a;
 let b:Record<string,unknown>;try{b=await req.json()}catch{return NextResponse.json({error:'Invalid input'},{status:400,headers:noStore})}
 const id=String(b.id||''),name=String(b.name||'').trim(),description=String(b.description||'').trim();
 if(id.length<8||name.length<3||name.length>90||description.length>2000||!imageValid(imageUrl))return NextResponse.json({error:'Invalid room details.'},{status:400,headers:noStore});
 try{
 const existing=await a.db.prepare('SELECT id FROM hotel_room_types WHERE id=? AND hotel_id=?').bind(id,a.hotelId).first();
 if(!existing)return NextResponse.json({error:'Room not found in your hotel.'},{status:404,headers:noStore});
 await a.db.prepare('UPDATE hotel_room_types SET display_name=?,description=?,image_url=? WHERE id=? AND hotel_id=?').bind(name,description,imageUrl||null,id,a.hotelId).run();
 return NextResponse.json({ok:true},{headers:noStore})
 }catch{return NextResponse.json({error:'Unable to update room.'},{status:503,headers:noStore})}
}
