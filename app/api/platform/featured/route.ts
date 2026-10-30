import {NextRequest,NextResponse} from 'next/server';
import {authorize,noStore} from '../../../../lib/platform/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
const dateOk=(d:unknown)=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
export async function GET(req:NextRequest){
 const a=await authorize(req,'platform');if(a instanceof NextResponse)return a;
 try{const p=await a.db.prepare(`SELECT p.id,p.hotel_id,p.start_date,p.end_date,p.display_order,p.image_url,h.display_name
 FROM featured_hotel_placements p JOIN hotels h ON h.id=p.hotel_id ORDER BY p.start_date DESC,p.display_order LIMIT 150`).all();
 return NextResponse.json({placements:p.results},{headers:noStore});
 }catch{return NextResponse.json({error:'Featured placement table unavailable.'},{status:503,headers:noStore})}
}
export async function POST(req:NextRequest){
 const a=await authorize(req,'platform');if(a instanceof NextResponse)return a;
 let b:Record<string,unknown>;try{b=await req.json()}catch{return NextResponse.json({error:'Invalid request.'},{status:400,headers:noStore})}
 const hotelId=String(b.hotelId||''),start=b.startDate,end=b.endDate,order=b.order,imageUrl=String(b.imageUrl||'').trim();
 if(!hotelId||!dateOk(start)||!dateOk(end)||(start as string)>(end as string)||typeof order!=='number'||!Number.isInteger(order)||order<1||order>5||imageUrl.length>1000||(imageUrl&&!/^https:\/\/[^\s]+$/.test(imageUrl)))
 return NextResponse.json({error:'Choose a hotel, valid dates and a position from 1 to 5.'},{status:400,headers:noStore});
 try{
 const hotel=await a.db.prepare("SELECT id FROM hotels WHERE id=? AND status='active' AND archived_at IS NULL").bind(hotelId).first();
 if(!hotel)return NextResponse.json({error:'Hotel not found.'},{status:404,headers:noStore});
 const conflicts=await a.db.prepare(`SELECT id FROM featured_hotel_placements
 WHERE NOT(end_date<? OR start_date>?) AND (display_order=? OR hotel_id=?) LIMIT 1`).bind(start as string,end as string,order,hotelId).first();
 if(conflicts)return NextResponse.json({error:'That slot or hotel is already scheduled in overlapping dates. Remove the existing placement first.'},{status:409,headers:noStore});
 await a.db.prepare('INSERT INTO featured_hotel_placements(id,hotel_id,start_date,end_date,display_order,image_url) VALUES(?,?,?,?,?,?)')
 .bind(crypto.randomUUID(),hotelId,start as string,end as string,order,imageUrl||null).run();
 return NextResponse.json({ok:true},{headers:noStore})
 }catch{return NextResponse.json({error:'Unable to schedule featured placement.'},{status:503,headers:noStore})}
}
export async function DELETE(req:NextRequest){
 const a=await authorize(req,'platform');if(a instanceof NextResponse)return a;
 let b:Record<string,unknown>;try{b=await req.json()}catch{return NextResponse.json({error:'Invalid input.'},{status:400,headers:noStore})}
 const id=String(b.id||'');if(!id||id.length>100)return NextResponse.json({error:'Invalid placement.'},{status:400,headers:noStore});
 try{await a.db.prepare('DELETE FROM featured_hotel_placements WHERE id=?').bind(id).run();return NextResponse.json({ok:true},{headers:noStore})}
 catch{return NextResponse.json({error:'Unable to remove placement.'},{status:503,headers:noStore})}
}
