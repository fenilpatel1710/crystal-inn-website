import {NextRequest,NextResponse} from 'next/server';
import {scryptSync,timingSafeEqual,randomBytes} from 'node:crypto';
import {environment,originValid,makeToken,HOTEL_COOKIE,noStore} from '../../../../lib/platform/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(req:NextRequest){
 if(!originValid(req))return NextResponse.json({error:'Invalid origin.'},{status:403,headers:noStore});
 const e=environment();if(!e.db||e.secret.length<32)return NextResponse.json({error:'Hotel authentication not configured.'},{status:503,headers:noStore});
 const raw=await req.text();if(raw.length>2048)return NextResponse.json({error:'Invalid input'},{status:400,headers:noStore});
 let email='',password='',hotelId='';
 try{const b=JSON.parse(raw);email=String(b.email||'').trim().toLowerCase();password=String(b.password||'');hotelId=String(b.hotelId||'')}catch{return NextResponse.json({error:'Invalid input'},{status:400,headers:noStore})}
 if(!email||!hotelId||password.length>128)return NextResponse.json({error:'Invalid credentials.'},{status:401,headers:noStore});
 try{
 const row=await e.db.prepare(`SELECT u.password_hash FROM hotel_admin_users u
 JOIN hotel_admin_memberships m ON m.admin_user_id=u.id
 JOIN hotels h ON h.id=m.hotel_id WHERE u.email=? AND u.status='active'
 AND m.hotel_id=? AND m.role='property_admin' AND h.status='active'`)
 .bind(email,hotelId).first<{password_hash:string|null}>();
 const hash=row?.password_hash||'',parts=hash.split(':');
 const fallback=randomBytes(16).toString('hex');
 const salt=parts.length===3&&parts[0]==='scrypt'?parts[1]:fallback;
 const expected=parts.length===3&&/^[a-f0-9]{128}$/i.test(parts[2])?Buffer.from(parts[2],'hex'):Buffer.alloc(64);
 const actual=scryptSync(password,salt,64);
 if(!row||!timingSafeEqual(actual,expected))return NextResponse.json({error:'Invalid hotel or login credentials.'},{status:401,headers:noStore});
 const r=NextResponse.json({ok:true},{headers:noStore});
 r.cookies.set(HOTEL_COOKIE,await makeToken(e.secret,{sub:email,role:'property_admin',hotelId}),{httpOnly:true,secure:true,sameSite:'strict',maxAge:3600,path:'/'});
 return r;
 }catch{return NextResponse.json({error:'Hotel login unavailable.'},{status:503,headers:noStore})}
}
