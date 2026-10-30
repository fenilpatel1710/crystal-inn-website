import {NextRequest,NextResponse} from 'next/server';
import {authorize,noStore} from '../../../../lib/platform/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const a=await authorize(req,'platform');if(a instanceof NextResponse)return a;
 try{const rows=await a.db.prepare(`SELECT q.id,q.guest_name,q.email,q.phone,q.subject,q.message,q.status,q.created_at,h.display_name AS hotel_name
 FROM guest_inquiries q LEFT JOIN hotels h ON h.id=q.hotel_id ORDER BY q.created_at DESC LIMIT 150`).all();
 return NextResponse.json({inquiries:rows.results},{headers:noStore})}
 catch{return NextResponse.json({error:'Inquiry inbox requires migration 0005.'},{status:503,headers:noStore})}
}
export async function PUT(req:NextRequest){
 const a=await authorize(req,'platform');if(a instanceof NextResponse)return a;
 let b:Record<string,unknown>;try{b=await req.json()}catch{return NextResponse.json({error:'Invalid input.'},{status:400,headers:noStore})}
 const id=String(b.id||''),status=String(b.status||'');
 if(id.length<8||id.length>120||!['new','in_progress','resolved'].includes(status))return NextResponse.json({error:'Invalid inquiry update.'},{status:400,headers:noStore});
 try{await a.db.batch([
 a.db.prepare('UPDATE guest_inquiries SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(status,id),
 a.db.prepare('INSERT INTO platform_admin_audit(id,actor_email,action,details) VALUES(?,?,?,?)').bind(crypto.randomUUID(),a.email,'update_inquiry',id+':'+status)
 ]);return NextResponse.json({ok:true},{headers:noStore})}
 catch{return NextResponse.json({error:'Could not update inquiry.'},{status:503,headers:noStore})}
}
