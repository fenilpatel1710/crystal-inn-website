import {NextRequest,NextResponse} from 'next/server';
import {getCloudflareContext} from '@opennextjs/cloudflare';
import {authorize} from '../../../../../lib/platform/auth';

export const runtime='nodejs';
export const dynamic='force-dynamic';

type R2Photo={body:ReadableStream<Uint8Array>|null;httpMetadata?:{contentType?:string}};
type Bucket={get:(key:string)=>Promise<R2Photo|null>};
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
function missing(){return new NextResponse(null,{status:404,headers})}
export async function GET(req:NextRequest){
 const q=req.nextUrl.searchParams,scope=q.get('scope');
 if(scope!=='platform'&&scope!=='hotel')return missing();
 const a=await authorize(req,scope);if(a instanceof NextResponse)return a;
 const roomId=q.get('roomId')||'',photoId=q.get('photoId')||'',hotelId=scope==='hotel'?a.hotelId:q.get('hotelId')||'';
 if(!hotelId||hotelId.length>120||!roomId||roomId.length>120||!photoId||photoId.length>120)return missing();
 if(scope==='hotel'&&q.get('hotelId')!==hotelId)return missing();
 try{
  const row=await a.db.prepare('SELECT a.object_key FROM hotel_room_gallery g JOIN hotel_media_assets a ON a.id=g.asset_id AND a.hotel_id=g.hotel_id JOIN hotel_room_types r ON r.id=g.room_id AND r.hotel_id=g.hotel_id WHERE g.hotel_id=? AND g.room_id=? AND g.id=? AND a.status=\'active\'').bind(hotelId,roomId,photoId).first<{object_key:string}>();
  if(!row)return missing();
  const media=(getCloudflareContext().env as unknown as {HOTEL_MEDIA?:Bucket}).HOTEL_MEDIA;
  if(!media)return new NextResponse(null,{status:503,headers});
  const image=await media.get(row.object_key);
  if(!image?.body||!/^image\/(jpeg|png|webp)$/.test(image.httpMetadata?.contentType||''))return missing();
  return new NextResponse(image.body,{status:200,headers:{...headers,'Content-Type':image.httpMetadata!.contentType!}});
 }catch{return new NextResponse(null,{status:503,headers})}
}
