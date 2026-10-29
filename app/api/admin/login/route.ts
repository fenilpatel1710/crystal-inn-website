import {NextRequest,NextResponse} from 'next/server';
import {timingSafeEqual,createHash} from 'node:crypto';
import {ADMIN_EMAIL,COOKIE,getAdminEnv,isConfigured,originOk,signSession,protectedHeaders} from '../../../../lib/admin/auth';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const message='Invalid email or password.';
export async function POST(req:NextRequest){
 if(!originOk(req))return NextResponse.json({error:'Invalid request origin.'},{status:403,headers:protectedHeaders});
 const env=getAdminEnv();
 if(!isConfigured(env)||!env.db)return NextResponse.json({error:'Admin password setup is incomplete.'},{status:503,headers:protectedHeaders});
 const db=env.db;
 const raw=await req.text().catch(()=>'');
 if(raw.length>2048)return NextResponse.json({error:'Invalid input.'},{status:400,headers:protectedHeaders});
 let email='', password='';
 try{
  const input=JSON.parse(raw) as Record<string,unknown>;
  email=typeof input.email==='string'?input.email.toLowerCase().trim():'';
  password=typeof input.password==='string'?input.password:'';
 }catch{return NextResponse.json({error:'Invalid input.'},{status:400,headers:protectedHeaders});}
 const ip=req.headers.get('cf-connecting-ip')||'unknown';
 const clientKey=createHash('sha256').update(env.secret+':'+ip).digest('hex');
 const now=Math.floor(Date.now()/1000);
 try{
  const row=await db.prepare('SELECT window_start,failed_attempts,locked_until FROM admin_login_attempts WHERE client_key=?')
    .bind(clientKey).first<{window_start:number;failed_attempts:number;locked_until:number}>();
  if(row&&row.locked_until>now)return NextResponse.json({error:'Too many sign-in attempts. Try again later.'},{status:429,headers:protectedHeaders});
  const digest=(value:string)=>createHash('sha256').update(value).digest();
  const expected=digest(env.password);
  const actual=digest(password);
  const valid=timingSafeEqual(expected,actual)&&email===ADMIN_EMAIL;
  if(!valid){
   const start=row&&now-row.window_start<900?row.window_start:now;
   const count=row&&now-row.window_start<900?row.failed_attempts+1:1;
   const lock=count>=5?now+900:0;
   await db.prepare(`INSERT INTO admin_login_attempts(client_key,window_start,failed_attempts,locked_until)
     VALUES(?,?,?,?) ON CONFLICT(client_key) DO UPDATE SET
     window_start=excluded.window_start,failed_attempts=excluded.failed_attempts,locked_until=excluded.locked_until`)
     .bind(clientKey,start,count,lock).run();
   return NextResponse.json({error:message},{status:401,headers:protectedHeaders});
  }
  await db.prepare('DELETE FROM admin_login_attempts WHERE client_key=?').bind(clientKey).run();
  const token=await signSession(env.secret);
  const response=NextResponse.json({ok:true,email:ADMIN_EMAIL},{headers:protectedHeaders});
  response.cookies.set(COOKIE,token,{httpOnly:true,secure:true,sameSite:'strict',path:'/',maxAge:28800});
  return response;
 }catch{
  return NextResponse.json({error:'Login service unavailable. Confirm the admin security database table exists.'},
   {status:503,headers:protectedHeaders});
 }
}
