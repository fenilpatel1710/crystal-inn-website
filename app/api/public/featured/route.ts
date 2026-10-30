import {NextResponse} from 'next/server';
import {environment,noStore} from '../../../../lib/platform/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){
 try{
 const e=environment();if(!e.db)throw Error('DB');
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Chicago'});
 const rows=await e.db.prepare(`SELECT h.id,h.slug,h.display_name,h.city,h.region,h.description,h.hero_image_url,
 p.display_order, COALESCE(p.image_url,
 (SELECT r.image_url FROM hotel_room_types r WHERE r.hotel_id=h.id AND r.is_active=1
 AND r.image_url IS NOT NULL AND r.image_url<>'' ORDER BY r.display_name LIMIT 1),
 h.hero_image_url) AS featured_image_url FROM featured_hotel_placements p JOIN hotels h ON h.id=p.hotel_id
 WHERE h.status='active' AND h.archived_at IS NULL AND p.start_date<=? AND p.end_date>=?
 ORDER BY p.display_order ASC,p.created_at ASC LIMIT 5`).bind(today,today).all();
 return NextResponse.json({hotels:rows.results},{headers:noStore});
 }catch{return NextResponse.json({hotels:[]},{headers:noStore})}
}
