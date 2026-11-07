import {NextRequest,NextResponse} from 'next/server';
import {getCloudflareContext} from '@opennextjs/cloudflare';
import {authorize,noStore} from '../../../../../lib/platform/auth';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const validPlaceId=(v:string)=>/^[A-Za-z0-9_-]{8,255}$/.test(v);
export async function GET(req:NextRequest){
 const auth=await authorize(req,'hotel');
 if(auth instanceof NextResponse)return auth;
 if(!auth.hotelId)return NextResponse.json({error:'Hotel access required.'},{status:403,headers:noStore});
 try{
  const h=await auth.db.prepare(`SELECT g.place_id FROM hotels h
   LEFT JOIN hotel_google_profiles g ON g.hotel_id=h.id
   WHERE h.id=?`).bind(auth.hotelId).first<{place_id:string|null}>();
  if(!h)return NextResponse.json({error:'Hotel not found.'},{status:404,headers:noStore});
  const placeId=(h.place_id||'').trim();
  const env=getCloudflareContext().env as unknown as Record<string,unknown>;
  const key=typeof env.GOOGLE_PLACES_API_KEY==='string'?env.GOOGLE_PLACES_API_KEY.trim():'';
  if(!key)return NextResponse.json({
   ready:false,reason:'The GOOGLE_PLACES_API_KEY secret is not configured on this Cloudflare Worker.'
  },{headers:noStore});
  if(!validPlaceId(placeId))return NextResponse.json({
   ready:false,reason:'This hotel does not have a valid saved Google Place ID. Choose its listing under Amenities & Google and save.'
  },{headers:noStore});
  let res:Response;
  try{
   res=await fetch('https://places.googleapis.com/v1/places/'+encodeURIComponent(placeId),{
    headers:{'X-Goog-Api-Key':key,'X-Goog-FieldMask':'rating,userRatingCount'},
    cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(7000)
   });
  }catch{return NextResponse.json({
   ready:false,reason:'Google Places could not be reached. Try again or check Cloudflare logs.'
  },{headers:noStore})}
  if(!res.ok){
   const cause=res.status===403?'Google rejected the API key. Check Places API (New), billing and API key restrictions.'
    :res.status===404?'Google did not find that Place ID. Verify the correct property listing.'
    :res.status===429?'Google Maps quota or request limit was reached.'
    :'Google Place Details returned HTTP '+res.status+'. Check Google Cloud billing, API activation and logs.';
   return NextResponse.json({ready:false,reason:cause},{headers:noStore});
  }
  const result=await res.json() as {rating?:unknown;userRatingCount?:unknown};
  if(typeof result.rating!=='number'||result.rating<1||result.rating>5)return NextResponse.json({
   ready:false,reason:'Google responded successfully, but this Place ID did not return a usable star rating.'
  },{headers:noStore});
  return NextResponse.json({
   ready:true,rating:result.rating,
   userRatingCount:typeof result.userRatingCount==='number'?result.userRatingCount:null,
   reason:'Google Place Details returned the hotel rating successfully.'
  },{headers:noStore});
 }catch{return NextResponse.json({error:'Unable to verify Google Place settings.'},{status:503,headers:noStore})}
}
