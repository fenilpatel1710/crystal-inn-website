import {NextResponse} from 'next/server';
import {environment,noStore} from '../../../../lib/platform/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
const nw={id:'crystal-inn-northwest-290',slug:'northwest-290',display_name:'Crystal Inn Northwest 290',city:'Houston',region:'TX',description:'Enjoy a comfortable stay in Northwest Houston.',public_phone:'713-993-6567',hero_image_url:null,is_legacy_booking:true};
export async function GET(){
 try{
  const e=environment();if(!e.db)throw Error('No DB');
  const rows=await e.db.prepare(`SELECT id,slug,display_name,city,region,description,public_phone,hero_image_url FROM hotels WHERE status='active' ORDER BY display_name`).all<Record<string,unknown>>();
  const hotels=rows.results.map(h=>({...h,is_legacy_booking:h.slug==='northwest-290'}));
  if(!hotels.some(h=>h.slug==='northwest-290'))hotels.unshift(nw);
  return NextResponse.json({hotels},{headers:noStore});
 }catch{return NextResponse.json({hotels:[nw],setupPending:true},{headers:noStore})}
}
