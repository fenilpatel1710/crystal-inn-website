import {NextRequest,NextResponse} from 'next/server';
import {randomBytes,scryptSync} from 'node:crypto';
import {authorize,noStore} from '../../../../lib/platform/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function PUT(req:NextRequest){
 const a=await authorize(req,'platform');if(a instanceof NextResponse)return a;
 let b:Record<string,unknown>;try{b=await req.json()}catch{return NextResponse.json({error:'Invalid input.'},{status:400,headers:noStore})}
 const managerId=String(b.managerId||''),action=String(b.action||''),password=String(b.password||'');
 if(managerId.length<8||managerId.length>100||!['suspend','activate','reset_password'].includes(action))
 return NextResponse.json({error:'Invalid manager request.'},{status:400,headers:noStore});
 try{
 const manager=await a.db.prepare('SELECT id,status FROM hotel_admin_users WHERE id=?').bind(managerId).first();
 if(!manager)return NextResponse.json({error:'Manager not found.'},{status:404,headers:noStore});
 if(action==='reset_password'){
  if(password.length<16||password.length>128)return NextResponse.json({error:'Password must contain 16–128 characters.'},{status:400,headers:noStore});
  const salt=randomBytes(16).toString('hex'),hashed='scrypt:'+salt+':'+scryptSync(password,salt,64).toString('hex');
  await a.db.prepare('UPDATE hotel_admin_users SET password_hash=?,credentials_changed_at=CURRENT_TIMESTAMP WHERE id=?').bind(hashed,managerId).run();
 }else{
  await a.db.prepare('UPDATE hotel_admin_users SET status=? WHERE id=?').bind(action==='activate'?'active':'suspended',managerId).run();
 }
 return NextResponse.json({ok:true},{headers:noStore})
 }catch{return NextResponse.json({error:'Unable to update manager.'},{status:503,headers:noStore})}
}
