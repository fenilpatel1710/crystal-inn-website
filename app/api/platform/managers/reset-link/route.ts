import {NextRequest,NextResponse} from 'next/server';
import {createHash,randomBytes} from 'node:crypto';
import {authorize,noStore} from '../../../../../lib/platform/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(req:NextRequest){
 const a=await authorize(req,'platform');if(a instanceof NextResponse)return a;
 let b:Record<string,unknown>;try{b=await req.json()}catch{return NextResponse.json({error:'Invalid request.'},{status:400,headers:noStore})}
 const managerId=String(b.managerId||'');
 if(!managerId||managerId.length>120)return NextResponse.json({error:'Invalid manager.'},{status:400,headers:noStore});
 const apiKey=process.env.RESEND_API_KEY,from=process.env.RESERVATION_FROM_EMAIL;
 if(!apiKey||!from)return NextResponse.json({error:'Email delivery is not configured. Set RESEND_API_KEY and a verified sender address first.'},{status:503,headers:noStore});
 try{
 const manager=await a.db.prepare("SELECT id,email FROM hotel_admin_users WHERE id=? AND status='active'").bind(managerId).first<{id:string;email:string}>();
 if(!manager)return NextResponse.json({error:'Active manager not found.'},{status:404,headers:noStore});
 const token=randomBytes(32).toString('hex'),hash=createHash('sha256').update(token).digest('hex'),expires=Math.floor(Date.now()/1000)+1800;
 const url='https://crystalinnstay.com/hotel-admin/reset-password?token='+encodeURIComponent(token);
 await a.db.batch([
 a.db.prepare('DELETE FROM manager_password_reset_tokens WHERE manager_id=?').bind(managerId),
 a.db.prepare('INSERT INTO manager_password_reset_tokens(token_hash,manager_id,expires_at) VALUES(?,?,?)').bind(hash,managerId,expires)
 ]);
 const response=await fetch('https://api.resend.com/emails',{method:'POST',
  headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},
  body:JSON.stringify({from,to:[manager.email],subject:'Crystal Inn — reset your hotel administrator password',
   text:'A password reset was requested for your hotel administrator account. This link expires in 30 minutes and can only be used once.\n\n'+url+'\n\nIf you did not expect this, contact the platform administrator.'})
 });
 if(!response.ok){
  await a.db.prepare('DELETE FROM manager_password_reset_tokens WHERE token_hash=?').bind(hash).run();
  return NextResponse.json({error:'Email provider could not deliver the recovery link.'},{status:502,headers:noStore});
 }
 await a.db.prepare('INSERT INTO platform_admin_audit(id,actor_email,action,manager_id) VALUES(?,?,?,?)').bind(crypto.randomUUID(),a.email,'send_manager_reset_link',managerId).run().catch(()=>{});
 return NextResponse.json({ok:true,message:'Recovery email requested.'},{headers:noStore});
 }catch{return NextResponse.json({error:'Recovery service unavailable. Check migration 0004 and email settings.'},{status:503,headers:noStore})}
}
