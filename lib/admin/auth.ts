import {getCloudflareContext} from '@opennextjs/cloudflare';
import {createRemoteJWKSet, jwtVerify} from 'jose';
import {NextRequest,NextResponse} from 'next/server';

export const ADMIN_EMAIL='crystalinngessner@gmail.com';
export interface D1Stmt {bind(...args:(string|number|null)[]):D1Stmt;all<T>():Promise<{results:T[]}>;first<T>():Promise<T|null>;run():Promise<unknown>}
export interface DB {prepare(sql:string):D1Stmt;batch(stmts:D1Stmt[]):Promise<unknown[]>}
const noStore={'Cache-Control':'no-store'};

export async function requireAdmin(req:NextRequest):Promise<{db:DB}|NextResponse>{
  try{
    const env=getCloudflareContext().env as Record<string,unknown>;
    const domain=String(env.CF_ACCESS_TEAM_DOMAIN||'').trim().toLowerCase().replace(/^https?:\/\//,'').replace(/\/$/,'');
    const aud=String(env.CF_ACCESS_AUD||'').trim();
    const token=req.headers.get('cf-access-jwt-assertion');
    if(!domain||!aud||!token||!/^[-a-z0-9.]+\.cloudflareaccess\.com$/.test(domain))
      return NextResponse.json({error:'Admin access is not configured.'},{status:403,headers:noStore});
    const jwks=createRemoteJWKSet(new URL('https://'+domain+'/cdn-cgi/access/certs'));
    const {payload}=await jwtVerify(token,jwks,{issuer:'https://'+domain,audience:aud,algorithms:['RS256']});
    const email=typeof payload.email==='string'?payload.email.toLowerCase().trim():'';
    if(email!==ADMIN_EMAIL) return NextResponse.json({error:'Not authorized.'},{status:403,headers:noStore});
    if(!env.DB) return NextResponse.json({error:'Database unavailable.'},{status:503,headers:noStore});
    return {db:env.DB as DB};
  }catch{
    return NextResponse.json({error:'Authentication required. Open the admin portal and sign in.'},{status:401,headers:noStore});
  }
}
export const protectedHeaders=noStore;
