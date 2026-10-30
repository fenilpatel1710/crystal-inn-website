import {NextResponse} from 'next/server';
import {environment,noStore} from '../../../../lib/platform/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
type HotelRecord={id:string;slug:string;display_name:string;city:string;region:string;description:string|null;public_phone:string|null;hero_image_url:string|null;rewards_enabled:number;is_legacy_booking:boolean};
export async function GET(){
 try{
  const e=environment();if(!e.db)throw Error('No DB');
  const rows=await e.db.prepare(`SELECT id,slug,display_name,city,region,description,public_phone,hero_image_url,rewards_enabled FROM hotels WHERE status='active' AND archived_at IS NULL ORDER BY display_name`).all<Omit<HotelRecord,'is_legacy_booking'>>();
  const hotels:HotelRecord[]=rows.results.map(h=>({...h,is_legacy_booking:h.slug==='northwest-290'}));
  return NextResponse.json({hotels},{headers:noStore});
 }catch{return NextResponse.json({hotels:[],setupPending:true,error:'Hotel directory unavailable.'},{status:503,headers:noStore})}
}
