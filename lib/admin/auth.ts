import {getCloudflareContext} from '@opennextjs/cloudflare';
import {SignJWT,jwtVerify} from 'jose';
import {NextRequest,NextResponse} from 'next/server';

export const ADMIN_EMAIL='crystalinngessner@gmail.com';
export const COOKIE='crystal_admin_session';
export interface D1Stmt {bind(...args:(string|number|null)[]):D1Stmt;all<T>():Promise<{results:T[]}>;first<T>():Promise<T|null>;run():Promise<unknown>}
export interface DB {prepare(sql:string):D1Stmt;batch(stmts:D1Stmt[]):Promise<unknown[]>}
export const protectedHeaders={'Cache-Control':'no-store'};
export function getAdminEnv(){
 const env=getCloudflareContext().env as Record<string,unknown>;
 const password=typeof env.ADMIN_PASSWORD==='string'?env.ADMIN_PASSWORD:'';
 const secret=typeof env.ADMIN_SESSION_SECRET==='string'?env.ADMIN_SESSION_SECRET:'';
 return {db:env.DB as DB|undefined,password,secret};
}
export function isConfigured(env:ReturnType<typeof getAdminEnv>){
 return Boolean(env.db&&env.password.length>=12&&new TextEncoder().encode(env.secret).length>=32);
}
export function originOk(req:NextRequest){
 const origin=req.headers.get('origin');
 if(!origin)return false;
 try{return new URL(origin).origin===new URL(req.url).origin}catch{return false}
}
export async function signSession(secret:string){
 return new SignJWT({email:ADMIN_EMAIL,role:'admin'})
  .setProtectedHeader({alg:'HS256'}).setIssuedAt().setIssuer('crystalinnstay-admin')
  .setAudience('crystalinnstay-admin-portal').setExpirationTime('1h')
  .sign(new TextEncoder().encode(secret));
}
export async function requireAdmin(req:NextRequest):Promise<{db:DB}|NextResponse>{
 try{
  const env=getAdminEnv();
  if(!isConfigured(env)||!env.db)return NextResponse.json({error:'Admin login is not configured.'},{status:503,headers:protectedHeaders});
  if(!['GET','HEAD','OPTIONS'].includes(req.method)&&!originOk(req))
   return NextResponse.json({error:'Invalid request origin.'},{status:403,headers:protectedHeaders});
  const token=req.cookies.get(COOKIE)?.value;
  if(!token)return NextResponse.json({error:'Sign in to view the admin portal.'},{status:401,headers:protectedHeaders});
  const {payload}=await jwtVerify(token,new TextEncoder().encode(env.secret),{
   issuer:'crystalinnstay-admin',audience:'crystalinnstay-admin-portal',algorithms:['HS256']
  });
  if(payload.email!==ADMIN_EMAIL||payload.role!=='admin')
   return NextResponse.json({error:'Not authorized.'},{status:403,headers:protectedHeaders});
  return {db:env.db};
 }catch{
  return NextResponse.json({error:'Please sign in again.'},{status:401,headers:protectedHeaders});
 }
}
