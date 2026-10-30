import {NextRequest,NextResponse} from 'next/server';
import {randomBytes,scryptSync} from 'node:crypto';
import {authorize,noStore} from '../../../../lib/platform/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const a=await authorize(req,'platform');if(a instanceof NextResponse)return a;
 try{
 const rows=await a.db.prepare(`SELECT u.id,u.email,u.status,m.hotel_id,h.display_name AS hotel_name,m.role
 FROM hotel_admin_users u JOIN hotel_admin_memberships m ON m.admin_user_id=u.id
 JOIN hotels h ON h.id=m.hotel_id ORDER BY h.display_name,u.email`).all();
 return NextResponse.json({managers:rows.results},{headers:noStore});
 }catch{return NextResponse.json({error:'Manager records unavailable.'},{status:503,headers:noStore})}
}
export async function POST(req:NextRequest){
 const a=await authorize(req,'platform');if(a instanceof NextResponse)return a;
 let b:Record<string,unknown>;try{b=await req.json()}catch{return NextResponse.json({error:'Invalid JSON'},{status:400,headers:noStore})}
 const email=String(b.email||'').trim().toLowerCase(),password=String(b.password||''),hotelId=String(b.hotelId||'');
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>200||password.length<16||password.length>128||hotelId.length>120)
 return NextResponse.json({error:'A valid email and a unique password of 16–128 characters are required.'},{status:400,headers:noStore});
 try{
 const hotel=await a.db.prepare('SELECT id FROM hotels WHERE id=?').bind(hotelId).first();
 if(!hotel)return NextResponse.json({error:'Hotel not found'},{status:404,headers:noStore});
 const id=crypto.randomUUID(),salt=randomBytes(16).toString('hex');
 const passwordHash='scrypt:'+salt+':'+scryptSync(password,salt,64).toString('hex');
 await a.db.batch([
 a.db.prepare(`INSERT INTO hotel_admin_users(id,email,password_hash,status) VALUES(?,?,?,'active')`).bind(id,email,passwordHash),
 a.db.prepare(`INSERT INTO hotel_admin_memberships(admin_user_id,hotel_id,role) VALUES(?,?,'property_admin')`).bind(id,hotelId)
 ]);
 return NextResponse.json({ok:true},{headers:noStore});
 }catch{return NextResponse.json({error:'Could not create manager. Email may already be registered; use a distinct account.'},{status:409,headers:noStore})}
}

export async function DELETE(req:NextRequest){
 const a=await authorize(req,'platform');if(a instanceof NextResponse)return a;
 let input:Record<string,unknown>;try{input=await req.json()}catch{return NextResponse.json({error:'Invalid input.'},{status:400,headers:noStore})}
 const managerId=String(input.managerId||''),hotelId=String(input.hotelId||''),confirmation=String(input.confirmation||'').trim().toLowerCase();
 if(managerId.length<8||managerId.length>120||hotelId.length<8||hotelId.length>120)
  return NextResponse.json({error:'Invalid manager assignment.'},{status:400,headers:noStore});
 try{
  const manager=await a.db.prepare(`SELECT u.id,u.email,h.display_name AS hotel_name
   FROM hotel_admin_users u JOIN hotel_admin_memberships m ON m.admin_user_id=u.id
   JOIN hotels h ON h.id=m.hotel_id WHERE u.id=? AND m.hotel_id=?`)
   .bind(managerId,hotelId).first<{id:string;email:string;hotel_name:string}>();
  if(!manager)return NextResponse.json({error:'Manager assignment not found.'},{status:404,headers:noStore});
  if(confirmation!==manager.email)return NextResponse.json({error:'Type the exact manager email to confirm deletion.'},{status:400,headers:noStore});
  // Remove the specific hotel assignment. Delete the account only when it has no
  // other hotel or platform-admin assignment, preserving shared-manager access.
  await a.db.batch([
   a.db.prepare('DELETE FROM hotel_admin_memberships WHERE admin_user_id=? AND hotel_id=?').bind(managerId,hotelId),
   a.db.prepare(`DELETE FROM manager_password_reset_tokens WHERE manager_id=?
    AND NOT EXISTS(SELECT 1 FROM hotel_admin_memberships WHERE admin_user_id=?)
    AND NOT EXISTS(SELECT 1 FROM platform_admin_memberships WHERE admin_user_id=?)`).bind(managerId,managerId,managerId),
   a.db.prepare(`DELETE FROM hotel_admin_users WHERE id=?
    AND NOT EXISTS(SELECT 1 FROM hotel_admin_memberships WHERE admin_user_id=?)
    AND NOT EXISTS(SELECT 1 FROM platform_admin_memberships WHERE admin_user_id=?)`).bind(managerId,managerId,managerId),
   a.db.prepare('INSERT INTO platform_admin_audit(id,actor_email,action,hotel_id,manager_id,details) VALUES(?,?,?,?,?,?)')
    .bind(crypto.randomUUID(),a.email,'delete_manager_assignment',hotelId,managerId,manager.email)
  ]);
  return NextResponse.json({ok:true,message:'Manager removed from hotel. Other hotel assignments, if any, remain.'},{headers:noStore});
 }catch{return NextResponse.json({error:'Could not remove manager. No changes were confirmed.'},{status:503,headers:noStore})}
}
