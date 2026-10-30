import {NextRequest,NextResponse} from 'next/server';
import {authorize,noStore} from '../../../../../lib/platform/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function PUT(req:NextRequest){
 const a=await authorize(req,'platform');if(a instanceof NextResponse)return a;
 let b:Record<string,unknown>;try{b=await req.json()}catch{return NextResponse.json({error:'Invalid request.'},{status:400,headers:noStore})}
 const hotelId=String(b.hotelId||''),action=String(b.action||''),confirmation=String(b.confirmation||'');
 if(!hotelId||hotelId.length>120||!['archive','restore'].includes(action))return NextResponse.json({error:'Invalid hotel or operation.'},{status:400,headers:noStore});
 try{
 const h=await a.db.prepare('SELECT id,display_name,status,archived_at FROM hotels WHERE id=?').bind(hotelId).first<{id:string;display_name:string;status:string;archived_at:string|null}>();
 if(!h)return NextResponse.json({error:'Hotel not found.'},{status:404,headers:noStore});
 if(action==='archive'){
  if(hotelId==='crystal-inn-northwest-290')return NextResponse.json({error:'Northwest 290 still uses the legacy reservation and admin system. Complete the property migration before archiving it.'},{status:409,headers:noStore});
  if(confirmation!==h.display_name)return NextResponse.json({error:'Enter the exact hotel name to confirm archival.'},{status:400,headers:noStore});
  await a.db.batch([
   a.db.prepare("UPDATE hotels SET status='suspended',archived_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND archived_at IS NULL").bind(hotelId),
   a.db.prepare('DELETE FROM featured_hotel_placements WHERE hotel_id=?').bind(hotelId),
   a.db.prepare('INSERT INTO platform_admin_audit(id,actor_email,action,hotel_id,details) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),a.email,'archive_hotel',hotelId,h.display_name)
  ]);
 }else{
  if(!h.archived_at)return NextResponse.json({error:'Hotel is not archived.'},{status:400,headers:noStore});
  await a.db.batch([
   a.db.prepare("UPDATE hotels SET status='draft',archived_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(hotelId),
   a.db.prepare('INSERT INTO platform_admin_audit(id,actor_email,action,hotel_id,details) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),a.email,'restore_hotel',hotelId,h.display_name)
  ]);
 }
 return NextResponse.json({ok:true},{headers:noStore});
 }catch{return NextResponse.json({error:'Archive service requires migration 0004 or is unavailable.'},{status:503,headers:noStore})}
}
