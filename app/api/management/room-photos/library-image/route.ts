import {NextRequest,NextResponse} from 'next/server';
import {getCloudflareContext} from '@opennextjs/cloudflare';
import {authorize} from '../../../../../lib/platform/auth';

export const runtime='nodejs';
export const dynamic='force-dynamic';
type R2Photo={body:ReadableStream<Uint8Array>|null;httpMetadata?:{contentType?:string}};
type Bucket={get:(key:string)=>Promise<R2Photo|null>};
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const missing=()=>new NextResponse(null,{status:404,headers});
export async function GET(req:NextRequest){
 const q=req.nextUrl.searchParams,scope=q.get('scope');
 if(scope!=='platform'&&scope!=='hotel')return missing();
 const a=await authorize(req,scope);if(a instanceof NextResponse)return a;
 const hotelId=scope==='hotel'?a.hotelId:q.get('hotelId')||'';
 const assetId=q.get('assetId')||'';
 if(!hotelId||!/^[a-zA-Z0-9-]{1,120}$/.test(hotelId)||!/^[a-zA-Z0-9-]{1,120}$/.test(assetId))return missing();
 if(scope==='hotel'&&q.get('hotelId')!==hotelId)return missing();
 try{
  const asset=await a.db.prepare('SELECT object_key FROM hotel_media_assets WHERE id=? AND hotel_id=?')
   .bind(assetId,hotelId).first<{object_key:string}>();
  if(!asset)return missing();
  const media=(getCloudflareContext().env as unknown as {HOTEL_MEDIA?:Bucket}).HOTEL_MEDIA;
  if(!media)return new NextResponse(null,{status:503,headers});
  const photo=await media.get(asset.object_key);
  const type=photo?.httpMetadata?.contentType||'';
  if(!photo?.body||!/^image\/(jpeg|png|webp)$/.test(type))return missing();
  return new NextResponse(photo.body,{status:200,headers:{...headers,'Content-Type':type,'Content-Security-Policy':"default-src 'none'; sandbox"}});
 }catch{return new NextResponse(null,{status:503,headers})}
}
