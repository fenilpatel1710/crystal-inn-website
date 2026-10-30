import {NextResponse} from 'next/server';
import {environment,noStore} from '../../../../lib/platform/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){
 try{
 const e=environment();if(!e.db)throw Error('DB');
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Chicago'});
 const rows=await e.db.prepare(`SELECT h.id,h.slug,h.display_name,h.city,h.region,h.description,h.hero_image_url,
 p.display_order FROM featured_hotel_placements p JOIN hotels h ON h.id=p.hotel_id
 WHERE h.status='active' AND p.start_date<=? AND p.end_date>=?
 ORDER BY p.display_order ASC,p.created_at ASC LIMIT 5`).bind(today,today).all();
 return NextResponse.json({hotels:rows.results},{headers:noStore});
 }catch{return NextResponse.json({hotels:[]},{headers:noStore})}
}
