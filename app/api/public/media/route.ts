import {NextRequest,NextResponse} from 'next/server';
import {getCloudflareContext} from '@opennextjs/cloudflare';
import {environment} from '../../../../lib/platform/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
type R2Image={body:ReadableStream<Uint8Array>|null;httpMetadata?:{contentType?:string};size:number};
type Bucket={get:(key:string)=>Promise<R2Image|null>};
export async function GET(req:NextRequest){
 const hotelId=new URL(req.url).searchParams.get('hotel')||'';
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(hotelId)||hotelId.length>120)
 return new NextResponse(null,{status:404,headers:{'Cache-Control':'no-store'}});
 try{
 const e=environment();const media=(getCloudflareContext().env as unknown as {HOTEL_MEDIA?:Bucket}).HOTEL_MEDIA;
 if(!e.db||!media)throw Error('R2 or DB not configured');
 // Never accept an arbitrary key from a public caller: only the Super Admin-approved image for an active hotel.
 const hotel=await e.db.prepare("SELECT hero_image_url FROM hotels WHERE id=? AND status='active' AND archived_at IS NULL").bind(hotelId).first<{hero_image_url:string|null}>();
 if(!hotel?.hero_image_url?.startsWith('r2:'))return new NextResponse(null,{status:404,headers:{'Cache-Control':'no-store'}});
 const image=await media.get(hotel.hero_image_url.slice(3));
 if(!image?.body)return new NextResponse(null,{status:404,headers:{'Cache-Control':'no-store'}});
 const type=image.httpMetadata?.contentType||'';
 if(!/^image\/(jpeg|png|webp|avif)$/.test(type))return new NextResponse(null,{status:415,headers:{'Cache-Control':'no-store'}});
 return new NextResponse(image.body,{status:200,headers:{'Content-Type':type,'Cache-Control':'public, max-age=60, must-revalidate','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
 }catch{return new NextResponse(null,{status:503,headers:{'Cache-Control':'no-store'}})}
}
