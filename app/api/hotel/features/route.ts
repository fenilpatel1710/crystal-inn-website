import {NextRequest,NextResponse} from 'next/server';
import {authorize,noStore} from '../../../../lib/platform/auth';
import {HOTEL_FEATURES,emptyFeatures,mergedFeatures,validGoogleReviewUrl,type FeatureFlags} from '../../../../lib/hotel-features';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const a=await authorize(req,'hotel');if(a instanceof NextResponse)return a;
 try{
  const [h,features,google]=await Promise.all([
   a.db.prepare('SELECT rewards_enabled FROM hotels WHERE id=?').bind(a.hotelId).first<{rewards_enabled:number}>(),
   a.db.prepare('SELECT feature_key,enabled FROM hotel_features WHERE hotel_id=?').bind(a.hotelId).all<{feature_key:string;enabled:number}>(),
   a.db.prepare('SELECT place_id,write_review_url FROM hotel_google_profiles WHERE hotel_id=?').bind(a.hotelId).first<{place_id:string|null;write_review_url:string|null}>()
  ]);
  return NextResponse.json({features:mergedFeatures(features.results,h?.rewards_enabled),googlePlaceId:google?.place_id||'',googleReviewUrl:google?.write_review_url||''},{headers:noStore});
 }catch{return NextResponse.json({error:'Hotel features unavailable. Apply migration 0011.'},{status:503,headers:noStore})}
}
export async function PUT(req:NextRequest){
 const a=await authorize(req,'hotel');if(a instanceof NextResponse)return a;
 let b:unknown;try{b=await req.json()}catch{return NextResponse.json({error:'Invalid input.'},{status:400,headers:noStore})}
 if(!b||typeof b!=='object'||Array.isArray(b))return NextResponse.json({error:'Invalid input.'},{status:400,headers:noStore});
 const body=b as Record<string,unknown>;
 const flags=body.features;
 if(!flags||typeof flags!=='object'||Array.isArray(flags))return NextResponse.json({error:'Feature selections required.'},{status:400,headers:noStore});
 const featureMap=flags as Record<string,unknown>;
 const allowed=new Set<string>(HOTEL_FEATURES.map(f=>f.key));
 if(Object.keys(featureMap).some(k=>!allowed.has(k))||HOTEL_FEATURES.some(f=>typeof featureMap[f.key]!=='boolean')){
  return NextResponse.json({error:'Select yes or no for each listed hotel feature.'},{status:400,headers:noStore});
 }
 const placeId=typeof body.googlePlaceId==='string'?body.googlePlaceId.trim():'';
 const reviewUrl=typeof body.googleReviewUrl==='string'?body.googleReviewUrl.trim():'';
 if(placeId.length>255||(placeId&&!/^[A-Za-z0-9_-]{8,255}$/.test(placeId))||!validGoogleReviewUrl(reviewUrl))
  return NextResponse.json({error:'Enter a valid Google Place ID and Google review URL.'},{status:400,headers:noStore});
 try{
  const statements=[
   a.db.prepare('UPDATE hotels SET rewards_enabled=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(featureMap.rewards?1:0,a.hotelId),
   ...HOTEL_FEATURES.filter(f=>f.key!=='rewards').map(f=>
    a.db.prepare(`INSERT INTO hotel_features(hotel_id,feature_key,enabled) VALUES(?,?,?)
     ON CONFLICT(hotel_id,feature_key) DO UPDATE SET enabled=excluded.enabled,updated_at=CURRENT_TIMESTAMP`)
     .bind(a.hotelId,f.key,featureMap[f.key]?1:0)),
   a.db.prepare(`INSERT INTO hotel_google_profiles(hotel_id,place_id,write_review_url) VALUES(?,?,?)
     ON CONFLICT(hotel_id) DO UPDATE SET place_id=excluded.place_id,write_review_url=excluded.write_review_url,updated_at=CURRENT_TIMESTAMP`)
     .bind(a.hotelId,placeId||null,reviewUrl||null)
  ];
  await a.db.batch(statements);
  return NextResponse.json({ok:true},{headers:noStore});
 }catch{return NextResponse.json({error:'Hotel feature settings could not be saved. Check migration 0011.'},{status:503,headers:noStore})}
}
