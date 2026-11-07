import {NextRequest,NextResponse} from 'next/server';
import {getCloudflareContext} from '@opennextjs/cloudflare';
import {environment} from '../../../../../lib/platform/auth';

export const runtime='nodejs';
export const dynamic='force-dynamic';

type Photo={body:ReadableStream<Uint8Array>|null;httpMetadata?:{contentType?:string}};
type Bucket={get:(key:string)=>Promise<Photo|null>};
type Optimized={response:(options?:{headers:Record<string,string>})=>Response};
type ImageBinding={
 input:(body:ReadableStream<Uint8Array>)=>{transform:(options:{width:number})=>{
  output:(options:{format:'image/webp';quality:number})=>Promise<Optimized>
 }}
};
const denied={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const successfulHeaders={
 'Cache-Control':'public, max-age=900, s-maxage=3600',
 'X-Content-Type-Options':'nosniff',
 'Content-Security-Policy':"default-src 'none'; sandbox"
} as const;
const widths=new Set(['360','720','1600']);

export async function GET(req:NextRequest){
 const q=req.nextUrl.searchParams;
 const roomId=q.get('room')||'',photoId=q.get('photo')||'';
 const requestedWidth=q.get('w')||'';
 if(!/^[0-9a-f-]{36}$/i.test(roomId)||!/^[0-9a-f-]{36}$/i.test(photoId))
  return new NextResponse(null,{status:404,headers:denied});
 if(requestedWidth&&!widths.has(requestedWidth))
  return new NextResponse(null,{status:400,headers:denied});
 try{
  const e=environment();
  const cloud=getCloudflareContext().env as unknown as {HOTEL_MEDIA?:Bucket;IMAGES?:ImageBinding};
  if(!e.db||!cloud.HOTEL_MEDIA)return new NextResponse(null,{status:503,headers:denied});
  // Verify the public image assignment BEFORE cache lookup. Deleted or unpublished
  // photos must not be served from the edge cache after their D1 row disappears.
  const row=await e.db.prepare(`SELECT a.object_key FROM hotel_room_gallery p
    JOIN hotel_media_assets a ON a.id=p.asset_id AND a.hotel_id=p.hotel_id
    JOIN hotel_room_types r ON r.id=p.room_id AND r.hotel_id=p.hotel_id AND r.is_active=1
    JOIN hotels h ON h.id=p.hotel_id AND h.status='active' AND h.archived_at IS NULL
    WHERE p.id=? AND p.room_id=? AND a.status='active'`)
    .bind(photoId,roomId).first<{object_key:string}>();
  if(!row)return new NextResponse(null,{status:404,headers:denied});

  // Public hotel photo URLs are immutable per assignment ID. Cache only
  // successfully authorized images, never failures or private assets.
  const edgeCache=(globalThis as unknown as {caches?:{default?:Cache}}).caches?.default;
  const cacheKey=new Request(req.url,{method:'GET'});
  if(edgeCache){
   const cached=await edgeCache.match(cacheKey).catch(()=>undefined);
   if(cached)return cached;
  }

  const image=await cloud.HOTEL_MEDIA.get(row.object_key);
  const type=image?.httpMetadata?.contentType||'';
  if(!image?.body||!/^image\/(jpeg|png|webp)$/.test(type))
   return new NextResponse(null,{status:404,headers:denied});

  let response:Response;
  if(requestedWidth&&cloud.IMAGES){
   // R2 originals can be 5 MB. Cloudflare Images binding resizes and encodes a
   // lightweight WebP for cards (720px) or lightbox (1600px) on demand.
   const output=await cloud.IMAGES.input(image.body)
    .transform({width:Number(requestedWidth)})
    .output({format:'image/webp',quality:78});
   response=output.response({headers:{...successfulHeaders}});
  }else{
   // Safe fallback if the optional IMAGES binding is unavailable.
   response=new Response(image.body,{status:200,headers:{
    ...successfulHeaders,'Content-Type':type
   }});
  }
  if(edgeCache&&response.ok){
   // Cache write is best effort. Request should still work when the Cache API
   // is unavailable on a local/development worker.
   await edgeCache.put(cacheKey,response.clone()).catch(()=>{});
  }
  return response;
 }catch{
  return new NextResponse(null,{status:503,headers:denied});
 }
}
