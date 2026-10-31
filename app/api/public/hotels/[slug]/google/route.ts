import {NextRequest,NextResponse} from 'next/server';
import {getCloudflareContext} from '@opennextjs/cloudflare';
import {environment,noStore} from '../../../../../../lib/platform/auth';
import {validGoogleReviewUrl} from '../../../../../../lib/hotel-features';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(_req:NextRequest,{params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>64)
  return NextResponse.json({error:'Hotel not found.'},{status:404,headers:noStore});
 try{
  const e=environment();if(!e.db)throw Error('DB unavailable');
  const h=await e.db.prepare(`SELECT g.place_id,g.write_review_url FROM hotels h
    LEFT JOIN hotel_google_profiles g ON g.hotel_id=h.id
    WHERE h.slug=? AND h.status='active' AND h.archived_at IS NULL`)
    .bind(slug).first<{place_id:string|null;write_review_url:string|null}>();
  if(!h)return NextResponse.json({error:'Hotel not found.'},{status:404,headers:noStore});
  const configuredUrl=h.write_review_url&&validGoogleReviewUrl(h.write_review_url)?h.write_review_url:null;
  const response:{rating:number|null;userRatingCount:number|null;writeReviewUrl:string|null;reviewsUrl:string|null;source:string;connected:boolean}={
   rating:null,userRatingCount:null,writeReviewUrl:configuredUrl,reviewsUrl:null,source:'Google Maps',connected:false
  };
  const env=getCloudflareContext().env as Record<string,unknown>;
  const key=typeof env.GOOGLE_PLACES_API_KEY==='string'?env.GOOGLE_PLACES_API_KEY:'';
  if(!key||!h.place_id||!/^[A-Za-z0-9_-]{8,255}$/.test(h.place_id))
   return NextResponse.json(response,{headers:noStore});
  try{
   const google=await fetch('https://places.googleapis.com/v1/places/'+encodeURIComponent(h.place_id),{
    headers:{'X-Goog-Api-Key':key,'X-Goog-FieldMask':'rating,userRatingCount,googleMapsLinks'},
    redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(5000)
   });
   if(!google.ok)return NextResponse.json(response,{headers:noStore});
   const p=await google.json() as {
    rating?:number;userRatingCount?:number;
    googleMapsLinks?:{writeAReviewUri?:string;reviewsUri?:string}
   };
   if(typeof p.rating==='number'&&p.rating>=1&&p.rating<=5){
    response.rating=p.rating;
    response.userRatingCount=Number.isInteger(p.userRatingCount)?p.userRatingCount!:null;
    response.connected=true;
   }
   const write=p.googleMapsLinks?.writeAReviewUri||'';
   const reviews=p.googleMapsLinks?.reviewsUri||'';
   if(validGoogleReviewUrl(write)&&write)response.writeReviewUrl=write;
   if(validGoogleReviewUrl(reviews)&&reviews)response.reviewsUrl=reviews;
  }catch{}
  return NextResponse.json(response,{headers:noStore});
 }catch{return NextResponse.json({error:'Google review details unavailable.'},{status:503,headers:noStore})}
}
