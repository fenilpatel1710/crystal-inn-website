import {NextResponse} from 'next/server';
import {environment,noStore} from '../../../../lib/platform/auth';
import {mergedFeatures} from '../../../../lib/hotel-features';
export const runtime='nodejs';export const dynamic='force-dynamic';
type HotelRecord={id:string;slug:string;display_name:string;city:string;region:string;description:string|null;public_phone:string|null;hero_image_url:string|null;rewards_enabled:number;is_legacy_booking:boolean};
export async function GET(){
 try{
  const e=environment();if(!e.db)throw Error('No DB');
  const rows=await e.db.prepare(`SELECT id,slug,display_name,city,region,description,public_phone,hero_image_url,rewards_enabled FROM hotels WHERE status='active' AND archived_at IS NULL ORDER BY display_name`).all<Omit<HotelRecord,'is_legacy_booking'>>();
  const featureRows=await e.db.prepare('SELECT hotel_id,feature_key,enabled FROM hotel_features WHERE enabled=1').all<{hotel_id:string;feature_key:string;enabled:number}>().catch(()=>({results:[] as {hotel_id:string;feature_key:string;enabled:number}[]}));
  const hotels=rows.results.map(h=>({...h,
   hero_image_url:h.hero_image_url?.startsWith('r2:')?'/api/public/media?hotel='+encodeURIComponent(h.id):h.hero_image_url,
   is_legacy_booking:h.slug==='northwest-290',
   features:mergedFeatures(featureRows.results.filter(f=>f.hotel_id===h.id),h.rewards_enabled)
  }));
  return NextResponse.json({hotels},{headers:noStore});
 }catch{return NextResponse.json({hotels:[],setupPending:true,error:'Hotel directory unavailable.'},{status:503,headers:noStore})}
}
