import {NextRequest,NextResponse} from 'next/server';
import {authorize,noStore} from '../../../../lib/platform/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function PUT(req:NextRequest){
 const a=await authorize(req,'platform');if(a instanceof NextResponse)return a;
 let b:Record<string,unknown>;try{b=await req.json()}catch{return NextResponse.json({error:'Invalid input.'},{status:400,headers:noStore})}
 const hotelId=String(b.hotelId||''),enabled=b.enabled;
 if(!hotelId||hotelId.length>120||typeof enabled!=='boolean')return NextResponse.json({error:'Invalid hotel setting.'},{status:400,headers:noStore});
 try{const hotel=await a.db.prepare('SELECT id FROM hotels WHERE id=?').bind(hotelId).first();
 if(!hotel)return NextResponse.json({error:'Hotel not found.'},{status:404,headers:noStore});
 await a.db.batch([
 a.db.prepare('UPDATE hotels SET rewards_enabled=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(enabled?1:0,hotelId),
 a.db.prepare('INSERT INTO platform_admin_audit(id,actor_email,action,hotel_id,details) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),a.email,'change_rewards_eligibility',hotelId,enabled?'enabled':'disabled')
 ]);
 return NextResponse.json({ok:true},{headers:noStore})}
 catch{return NextResponse.json({error:'Unable to change rewards participation.'},{status:503,headers:noStore})}
}
