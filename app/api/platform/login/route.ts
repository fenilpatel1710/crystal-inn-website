import {NextRequest,NextResponse} from 'next/server';
import {createHash,timingSafeEqual} from 'node:crypto';
import {environment,platformConfigured,originValid,makeToken,PLATFORM_COOKIE,noStore} from '../../../../lib/platform/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(req:NextRequest){
 if(!originValid(req))return NextResponse.json({error:'Invalid origin.'},{status:403,headers:noStore});
 const e=environment();if(!platformConfigured(e))return NextResponse.json({error:'Platform admin must first be configured in Cloudflare secrets.'},{status:503,headers:noStore});
 const raw=await req.text();if(raw.length>2048)return NextResponse.json({error:'Invalid input'},{status:400,headers:noStore});
 let email='',password='';
 try{const b=JSON.parse(raw);email=String(b.email||'').toLowerCase().trim();password=String(b.password||'')}catch{return NextResponse.json({error:'Invalid input'},{status:400,headers:noStore})}
 const key=createHash('sha256').update(e.secret+':platform:'+String(req.headers.get('cf-connecting-ip')||'unknown')).digest('hex');
 const now=Math.floor(Date.now()/1000);
 try{
 const row=await e.db!.prepare('SELECT window_start,failed_attempts,locked_until FROM admin_login_attempts WHERE client_key=?').bind(key).first<{window_start:number;failed_attempts:number;locked_until:number}>();
 if(row&&row.locked_until>now)return NextResponse.json({error:'Too many attempts. Try again later.'},{status:429,headers:noStore});
 const hash=(s:string)=>createHash('sha256').update(s).digest();
 const valid=email===e.platformEmail&&timingSafeEqual(hash(password),hash(e.platformPassword));
 if(!valid){
 const start=row&&now-row.window_start<900?row.window_start:now;
 const count=row&&now-row.window_start<900?row.failed_attempts+1:1;
 await e.db!.prepare(`INSERT INTO admin_login_attempts(client_key,window_start,failed_attempts,locked_until) VALUES(?,?,?,?)
 ON CONFLICT(client_key) DO UPDATE SET window_start=excluded.window_start,failed_attempts=excluded.failed_attempts,locked_until=excluded.locked_until`)
 .bind(key,start,count,count>=5?now+900:0).run();
 return NextResponse.json({error:'Invalid credentials.'},{status:401,headers:noStore});
 }
 await e.db!.prepare('DELETE FROM admin_login_attempts WHERE client_key=?').bind(key).run();
 const response=NextResponse.json({ok:true},{headers:noStore});
 response.cookies.set(PLATFORM_COOKIE,await makeToken(e.secret,{sub:email,role:'platform_admin'}),{httpOnly:true,secure:true,sameSite:'strict',maxAge:3600,path:'/'});
 return response;
 }catch{return NextResponse.json({error:'Platform sign-in service unavailable.'},{status:503,headers:noStore})}
}
