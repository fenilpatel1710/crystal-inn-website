import {NextRequest,NextResponse} from 'next/server';
import {authorize,noStore} from '../../../../../lib/platform/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function PUT(req:NextRequest){
 const a=await authorize(req,'platform');if(a instanceof NextResponse)return a;
 let b:Record<string,unknown>;try{b=await req.json()}catch{return NextResponse.json({error:'Invalid input.'},{status:400,headers:noStore})}
 const hotelId=String(b.hotelId||''),status=String(b.status||'');
 if(hotelId.length>120||!['draft','active','suspended'].includes(status))
 return NextResponse.json({error:'Invalid property/status.'},{status:400,headers:noStore});
 try{
 const hotel=await a.db.prepare('SELECT id,status FROM hotels WHERE id=?').bind(hotelId).first<{id:string;status:string}>();
 if(!hotel)return NextResponse.json({error:'Hotel not found.'},{status:404,headers:noStore});
 if(status==='active'){
 const membership=await a.db.prepare(`SELECT 1 AS ok FROM hotel_admin_memberships m JOIN hotel_admin_users u ON u.id=m.admin_user_id
 WHERE m.hotel_id=? AND m.role='property_admin' AND u.status='active' LIMIT 1`).bind(hotelId).first();
 if(!membership)return NextResponse.json({error:'Assign an active hotel administrator before activating.'},{status:400,headers:noStore});
 }
 await a.db.prepare('UPDATE hotels SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(status,hotelId).run();
 return NextResponse.json({ok:true},{headers:noStore});
 }catch{return NextResponse.json({error:'Status update failed.'},{status:503,headers:noStore})}
}
