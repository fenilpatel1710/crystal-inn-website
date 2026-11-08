import {NextRequest,NextResponse} from 'next/server';
import {getCloudflareContext} from '@opennextjs/cloudflare';
import {environment} from '../../../../../lib/platform/auth';
import {loadHomepageGallery} from '../../../../../lib/homepage-media';
export const runtime='nodejs';export const dynamic='force-dynamic';
type Image={body:ReadableStream<Uint8Array>|null;httpMetadata?:{contentType?:string}};
type Bucket={get:(key:string)=>Promise<Image|null>};
export async function GET(req:NextRequest){
 const id=new URL(req.url).searchParams.get('id')||'';
 if(!/^[0-9a-f-]{36}$/.test(id))return new NextResponse(null,{status:404,headers:{'Cache-Control':'no-store'}});
 try{
  const env=environment();
  const bucket=(getCloudflareContext().env as unknown as {HOTEL_MEDIA?:Bucket}).HOTEL_MEDIA;
  if(!env.db||!bucket)throw Error('Storage unavailable');
  const gallery=await loadHomepageGallery(env.db),photo=gallery.photos.find(p=>p.id===id);
  if(!photo)return new NextResponse(null,{status:404,headers:{'Cache-Control':'no-store'}});
  const image=await bucket.get(photo.key);
  if(!image?.body)return new NextResponse(null,{status:404,headers:{'Cache-Control':'no-store'}});
  const mime=image.httpMetadata?.contentType;
  if(!mime||!/^image\/(jpeg|png|webp)$/.test(mime))
   return new NextResponse(null,{status:415,headers:{'Cache-Control':'no-store'}});
  return new NextResponse(image.body,{headers:{
   'Content-Type':mime,'Cache-Control':'public,max-age=300,stale-while-revalidate=3600',
   'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"
  }});
 }catch{return new NextResponse(null,{status:503,headers:{'Cache-Control':'no-store'}})}
}
