import {NextResponse} from 'next/server';
import {environment,noStore} from '../../../../lib/platform/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
const nw={id:'crystal-inn-northwest-290',slug:'northwest-290',display_name:'Crystal Inn Northwest 290',city:'Houston',region:'TX',description:'Enjoy a comfortable stay in Northwest Houston.',public_phone:'713-993-6567',hero_image_url:null,rewards_enabled:0,is_legacy_booking:true};
type HotelRecord={id:string;slug:string;display_name:string;city:string;region:string;description:string|null;public_phone:string|null;hero_image_url:string|null;rewards_enabled:number;is_legacy_booking:boolean};
export async function GET(){
 try{
  const e=environment();if(!e.db)throw Error('No DB');
  const rows=await e.db.prepare(`SELECT id,slug,display_name,city,region,description,public_phone,hero_image_url,rewards_enabled FROM hotels WHERE status='active' AND archived_at IS NULL ORDER BY display_name`).all<Omit<HotelRecord,'is_legacy_booking'>>();
  const hotels:HotelRecord[]=rows.results.map(h=>({...h,is_legacy_booking:h.slug==='northwest-290'}));
  // Legacy fallback is only for a missing multi-property schema, never for a suspended/archived property.
  return NextResponse.json({hotels},{headers:noStore});
 }catch{return NextResponse.json({hotels:[nw],setupPending:true},{headers:noStore})}
}
