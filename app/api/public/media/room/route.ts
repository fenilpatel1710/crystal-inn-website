import {NextRequest,NextResponse} from 'next/server';
import {getCloudflareContext} from '@opennextjs/cloudflare';
import {environment} from '../../../../../lib/platform/auth';

export const runtime='nodejs';
export const dynamic='force-dynamic';
type Photo={body:ReadableStream<Uint8Array>|null;httpMetadata?:{contentType?:string}};
type Bucket={get:(key:string)=>Promise<Photo|null>};
const denied={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
export async function GET(req:NextRequest){
 const q=req.nextUrl.searchParams;
 const roomId=q.get('room')||'',photoId=q.get('photo')||'';
 if(!/^[0-9a-f-]{36}$/i.test(roomId)||!/^[0-9a-f-]{36}$/i.test(photoId))return new NextResponse(null,{status:404,headers:denied});
 try{
  const e=environment();
  const media=(getCloudflareContext().env as unknown as {HOTEL_MEDIA?:Bucket}).HOTEL_MEDIA;
  if(!e.db||!media)return new NextResponse(null,{status:503,headers:denied});
  // Never expose arbitrary R2 object keys: each public photo must belong to an active room and an active hotel.
  const row=await e.db.prepare(`SELECT p.object_key FROM hotel_room_photos p
    JOIN hotel_room_types r ON r.id=p.room_id AND r.hotel_id=p.hotel_id AND r.is_active=1
    JOIN hotels h ON h.id=p.hotel_id AND h.status='active' AND h.archived_at IS NULL
    WHERE p.id=? AND p.room_id=?`).bind(photoId,roomId).first<{object_key:string}>();
  if(!row)return new NextResponse(null,{status:404,headers:denied});
  const image=await media.get(row.object_key);
  const type=image?.httpMetadata?.contentType||'';
  if(!image?.body||!/^image\/(jpeg|png|webp)$/.test(type))return new NextResponse(null,{status:404,headers:denied});
  return new NextResponse(image.body,{status:200,headers:{'Content-Type':type,'Cache-Control':'public, max-age=60, must-revalidate','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
 }catch{return new NextResponse(null,{status:503,headers:denied})}
}
