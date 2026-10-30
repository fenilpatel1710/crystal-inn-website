import {NextRequest,NextResponse} from 'next/server';
import {authorize,noStore} from '../../../../lib/platform/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const a=await authorize(req,'platform');if(a instanceof NextResponse)return a;
 try{const rows=await a.db.prepare(`SELECT h.id,h.slug,h.display_name,h.city,h.region,h.status,h.rewards_enabled,h.archived_at,h.lumen_hotel_id,h.subscription_status,h.subscription_amount_cents,h.subscription_renewal_date,
  COUNT(m.admin_user_id) AS manager_count FROM hotels h LEFT JOIN hotel_admin_memberships m ON m.hotel_id=h.id
  GROUP BY h.id ORDER BY h.created_at DESC`).all();
 return NextResponse.json({hotels:rows.results},{headers:noStore})}
 catch{return NextResponse.json({error:'Multi-property schema not installed.'},{status:503,headers:noStore})}
}
export async function POST(req:NextRequest){
 const a=await authorize(req,'platform');if(a instanceof NextResponse)return a;
 let b:Record<string,unknown>;try{b=await req.json()}catch{return NextResponse.json({error:'Invalid request.'},{status:400,headers:noStore})}
 const name=String(b.name||'').trim(),city=String(b.city||'').trim(),region=String(b.region||'').trim().toUpperCase(),slug=String(b.slug||'').trim().toLowerCase();
 if(name.length<3||name.length>100||city.length<2||city.length>80||!/^[A-Z]{2}$/.test(region)||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>64)
  return NextResponse.json({error:'Enter a valid hotel name, city, two-letter state and unique URL slug.'},{status:400,headers:noStore});
 try{
 const id=crypto.randomUUID();
 await a.db.prepare(`INSERT INTO hotels(id,slug,display_name,city,region,status) VALUES(?,?,?,?,?,'draft')`).bind(id,slug,name,city,region).run();
 return NextResponse.json({ok:true,id},{headers:noStore});
 }catch{return NextResponse.json({error:'Could not add hotel. The slug may already exist.'},{status:409,headers:noStore})}
}
