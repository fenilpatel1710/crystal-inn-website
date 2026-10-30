import {NextRequest,NextResponse} from 'next/server';
import {authorize,noStore} from '../../../../lib/platform/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function PUT(req:NextRequest){
 const a=await authorize(req,'platform');if(a instanceof NextResponse)return a;
 let b:Record<string,unknown>;try{b=await req.json()}catch{return NextResponse.json({error:'Invalid input.'},{status:400,headers:noStore})}
 const id=String(b.hotelId||''),status=String(b.status||''),amount=Number(b.amountCents),renewal=String(b.renewalDate||'').trim();
 if(!id||id.length>120||!['not_configured','trial','active','past_due','cancelled'].includes(status)||
 !Number.isSafeInteger(amount)||amount<0||amount>100000000||(renewal&&!/^\d{4}-\d{2}-\d{2}$/.test(renewal)))
 return NextResponse.json({error:'Invalid subscription details.'},{status:400,headers:noStore});
 try{await a.db.batch([
 a.db.prepare('UPDATE hotels SET subscription_status=?,subscription_amount_cents=?,subscription_renewal_date=?,updated_at=CURRENT_TIMESTAMP WHERE id=?')
 .bind(status,amount,renewal||null,id),
 a.db.prepare('INSERT INTO platform_admin_audit(id,actor_email,action,hotel_id,details) VALUES(?,?,?,?,?)')
 .bind(crypto.randomUUID(),a.email,'update_subscription',id,status)
 ]);return NextResponse.json({ok:true},{headers:noStore})}
 catch{return NextResponse.json({error:'Could not update subscription record.'},{status:503,headers:noStore})}
}
