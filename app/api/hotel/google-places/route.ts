import {NextRequest,NextResponse} from 'next/server';
import {getCloudflareContext} from '@opennextjs/cloudflare';
import {authorize,noStore} from '../../../../lib/platform/auth';
import {validGoogleReviewUrl} from '../../../../lib/hotel-features';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const placeIdPattern=/^[A-Za-z0-9_-]{8,255}$/;
type GooglePlace={
 id?:string;
 displayName?:{text?:string};
 formattedAddress?:string;
 googleMapsUri?:string;
 googleMapsLinks?:{writeAReviewUri?:string};
};
function safeMapsUrl(value:unknown):string {
 return typeof value==='string'&&value.length<=1500&&validGoogleReviewUrl(value)?value:'';
}

export async function POST(req:NextRequest){
 const auth=await authorize(req,'hotel');
 if(auth instanceof NextResponse)return auth;
 if(!auth.hotelId)return NextResponse.json({error:'Property login required.'},{status:403,headers:noStore});
 let body:{action?:unknown;placeId?:unknown};
 try{body=await req.json()}catch{return NextResponse.json({error:'Invalid request.'},{status:400,headers:noStore})}
 if(body.action!=='search'&&body.action!=='details')
  return NextResponse.json({error:'Unsupported lookup.'},{status:400,headers:noStore});
 const env=getCloudflareContext().env as unknown as Record<string,unknown>;
 const key=typeof env.GOOGLE_PLACES_API_KEY==='string'?env.GOOGLE_PLACES_API_KEY.trim():'';
 if(!key)return NextResponse.json({
  error:'Google Places API is not configured. Enable Places API (New), attach billing, and set GOOGLE_PLACES_API_KEY as a Cloudflare Worker secret. You can still enter your Google Place ID manually.'
 },{status:409,headers:noStore});
 try{
  const hotel=await auth.db.prepare('SELECT display_name,address_text,city,region FROM hotels WHERE id=?')
   .bind(auth.hotelId).first<{display_name:string;address_text:string|null;city:string;region:string}>();
  if(!hotel)return NextResponse.json({error:'Hotel not found.'},{status:404,headers:noStore});
  if(body.action==='search'){
   if(!hotel.address_text?.trim())return NextResponse.json({
    error:'Save this hotel\'s full street address under Hotel details before searching Google.'
   },{status:400,headers:noStore});
   // Query solely the authenticated hotel's stored identity; no cross-property search.
   const q=[hotel.display_name,hotel.address_text,hotel.city,hotel.region].join(', ').slice(0,450);
   const response=await fetch('https://places.googleapis.com/v1/places:searchText',{
    method:'POST',
    headers:{'Content-Type':'application/json','X-Goog-Api-Key':key,
     'X-Goog-FieldMask':'places.id,places.displayName,places.formattedAddress,places.googleMapsUri'},
    body:JSON.stringify({textQuery:q,pageSize:5}),
    cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(7000)
   });
   if(!response.ok)return NextResponse.json({
    error:response.status===403?'Google Places API rejected the key. Verify Places API (New), billing and key restrictions.':
     'Google Places search unavailable (HTTP '+response.status+').'
   },{status:502,headers:noStore});
   const data=await response.json() as {places?:GooglePlace[]};
   const results=(data.places||[]).filter(p=>p.id&&placeIdPattern.test(p.id))
    .slice(0,5).map(p=>({
     placeId:p.id,name:(p.displayName?.text||'').slice(0,160),
     address:(p.formattedAddress||'').slice(0,300),
     mapsUrl:safeMapsUrl(p.googleMapsUri)
    }));
   return NextResponse.json({results},{headers:noStore});
  }
  const id=typeof body.placeId==='string'?body.placeId.trim():'';
  if(!placeIdPattern.test(id))return NextResponse.json({error:'Invalid Place ID.'},{status:400,headers:noStore});
  const details=await fetch('https://places.googleapis.com/v1/places/'+encodeURIComponent(id),{
   headers:{'X-Goog-Api-Key':key,
    'X-Goog-FieldMask':'id,displayName,formattedAddress,googleMapsLinks,googleMapsUri'},
   cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(7000)
  });
  if(!details.ok)return NextResponse.json({error:'Unable to verify the selected Google listing (HTTP '+details.status+').'},
   {status:502,headers:noStore});
  const p=await details.json() as GooglePlace;
  if(p.id!==id)return NextResponse.json({error:'Google listing did not match the selected Place ID.'},{status:409,headers:noStore});
  const reviewUrl=safeMapsUrl(p.googleMapsLinks?.writeAReviewUri);
  const mapsUrl=safeMapsUrl(p.googleMapsUri);
  return NextResponse.json({
   placeId:id,
   name:(p.displayName?.text||'').slice(0,160),
   address:(p.formattedAddress||'').slice(0,300),
   reviewUrl,
   mapsUrl
  },{headers:noStore});
 }catch{
  return NextResponse.json({error:'Google Places request failed. Please retry.'},{status:503,headers:noStore});
 }
}
