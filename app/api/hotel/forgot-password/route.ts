import {NextRequest,NextResponse} from 'next/server';
import {createHash,randomBytes} from 'node:crypto';
import {environment,originValid,noStore} from '../../../../lib/platform/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
const generic={ok:true,message:'If an active manager account matches, a recovery email will be sent.'};
export async function POST(req:NextRequest){
 if(!originValid(req))return NextResponse.json({error:'Invalid request origin.'},{status:403,headers:noStore});
 const e=environment();if(!e.db)return NextResponse.json({error:'Recovery temporarily unavailable.'},{status:503,headers:noStore});
 const raw=await req.text();if(raw.length>600)return NextResponse.json({error:'Invalid input.'},{status:400,headers:noStore});
 let email='';try{const b=JSON.parse(raw);email=String(b.email||'').trim().toLowerCase()}catch{return NextResponse.json({error:'Invalid input.'},{status:400,headers:noStore})}
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>200)return NextResponse.json({error:'Enter a valid email.'},{status:400,headers:noStore});
 const apiKey=process.env.RESEND_API_KEY,from=process.env.RESERVATION_FROM_EMAIL;
 if(!apiKey||!from)return NextResponse.json({error:'Password recovery email service is not configured.'},{status:503,headers:noStore});
 const ip=req.headers.get('cf-connecting-ip')||'unknown';
 const clientKey=createHash('sha256').update(e.secret+':forgot:'+ip+':'+email).digest('hex');
 const now=Math.floor(Date.now()/1000);
 try{
 const prior=await e.db.prepare('SELECT window_start,failed_attempts FROM admin_login_attempts WHERE client_key=?').bind(clientKey).first<{window_start:number;failed_attempts:number}>();
 if(prior&&now-prior.window_start<3600&&prior.failed_attempts>=3)return NextResponse.json(generic,{headers:noStore});
 const count=prior&&now-prior.window_start<3600?prior.failed_attempts+1:1;
 const start=prior&&now-prior.window_start<3600?prior.window_start:now;
 await e.db.prepare(`INSERT INTO admin_login_attempts(client_key,window_start,failed_attempts,locked_until) VALUES(?,?,?,0)
 ON CONFLICT(client_key) DO UPDATE SET window_start=excluded.window_start,failed_attempts=excluded.failed_attempts,locked_until=0`).bind(clientKey,start,count).run();
 const row=await e.db.prepare(`SELECT u.id,u.email FROM hotel_admin_users u WHERE u.email=? AND u.status='active'
 AND EXISTS(SELECT 1 FROM hotel_admin_memberships m JOIN hotels h ON h.id=m.hotel_id
 WHERE m.admin_user_id=u.id AND m.role='property_admin' AND h.status='active' AND h.archived_at IS NULL)`).bind(email).first<{id:string;email:string}>();
 if(!row)return NextResponse.json(generic,{headers:noStore});
 const token=randomBytes(32).toString('hex'),hash=createHash('sha256').update(token).digest('hex');
 const url='https://crystalinnstay.com/hotel-admin/reset-password?token='+token;
 await e.db.batch([
 e.db.prepare('DELETE FROM manager_password_reset_tokens WHERE manager_id=?').bind(row.id),
 e.db.prepare('INSERT INTO manager_password_reset_tokens(token_hash,manager_id,expires_at) VALUES(?,?,?)').bind(hash,row.id,now+1800)
 ]);
 const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify({from,to:[row.email],subject:'Crystal Inn — reset your hotel administrator password',text:'Use this one-time link within 30 minutes to reset your password:\n\n'+url+'\n\nIf you did not request it, you can ignore this email.'})});
 if(!response.ok)await e.db.prepare('DELETE FROM manager_password_reset_tokens WHERE token_hash=?').bind(hash).run();
 return NextResponse.json(generic,{headers:noStore});
 }catch{return NextResponse.json(generic,{headers:noStore})}
}
