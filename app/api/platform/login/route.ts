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
 const hash=(s:string)=>createHash('sha256').update(s).digest();
 const valid=email===e.platformEmail&&timingSafeEqual(hash(password),hash(e.platformPassword));
 if(!valid)return NextResponse.json({error:'Invalid credentials.'},{status:401,headers:noStore});
 const response=NextResponse.json({ok:true},{headers:noStore});
 response.cookies.set(PLATFORM_COOKIE,await makeToken(e.secret,{sub:email,role:'platform_admin'}),{httpOnly:true,secure:true,sameSite:'strict',maxAge:3600,path:'/'});
 return response;
}
