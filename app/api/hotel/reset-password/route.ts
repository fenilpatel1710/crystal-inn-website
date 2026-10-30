import {NextRequest,NextResponse} from 'next/server';
import {createHash,randomBytes,scryptSync} from 'node:crypto';
import {environment,originValid,noStore} from '../../../../lib/platform/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(req:NextRequest){
 if(!originValid(req))return NextResponse.json({error:'Invalid origin.'},{status:403,headers:noStore});
 const e=environment();if(!e.db)return NextResponse.json({error:'Unavailable.'},{status:503,headers:noStore});
 const raw=await req.text();if(raw.length>1400)return NextResponse.json({error:'Invalid request.'},{status:400,headers:noStore});
 let token='',password='';try{const b=JSON.parse(raw);token=String(b.token||'');password=String(b.password||'')}catch{return NextResponse.json({error:'Invalid request.'},{status:400,headers:noStore})}
 if(!/^[a-f0-9]{64}$/.test(token)||password.length<16||password.length>128)return NextResponse.json({error:'Invalid reset link or password. Password must contain 16–128 characters.'},{status:400,headers:noStore});
 const hash=createHash('sha256').update(token).digest('hex'),now=Math.floor(Date.now()/1000);
 try{
 const row=await e.db.prepare(`SELECT t.manager_id FROM manager_password_reset_tokens t JOIN hotel_admin_users u ON u.id=t.manager_id
 WHERE t.token_hash=? AND t.used_at IS NULL AND t.expires_at>? AND u.status='active'`).bind(hash,now).first<{manager_id:string}>();
 if(!row)return NextResponse.json({error:'Link expired or already used. Request a new link from your platform administrator.'},{status:400,headers:noStore});
 const salt=randomBytes(16).toString('hex'),hashed='scrypt:'+salt+':'+scryptSync(password,salt,64).toString('hex');
 // Atomic conditional claim prevents two simultaneous uses of the same token.
 const claim=await e.db.prepare('UPDATE manager_password_reset_tokens SET used_at=? WHERE token_hash=? AND used_at IS NULL AND expires_at>? RETURNING manager_id').bind(now,hash,now).first<{manager_id:string}>();
 if(!claim)return NextResponse.json({error:'Reset link has already been used.'},{status:400,headers:noStore});
 await e.db.batch([
 e.db.prepare('UPDATE hotel_admin_users SET password_hash=?,session_version=session_version+1,credentials_changed_at=CURRENT_TIMESTAMP WHERE id=?').bind(hashed,claim.manager_id),
 e.db.prepare('DELETE FROM manager_password_reset_tokens WHERE manager_id=?').bind(claim.manager_id)
 ]);
 return NextResponse.json({ok:true},{headers:noStore});
 }catch{return NextResponse.json({error:'Unable to reset password.'},{status:503,headers:noStore})}
}
