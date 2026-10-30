import {getCloudflareContext} from '@opennextjs/cloudflare';
import {SignJWT,jwtVerify} from 'jose';
import {NextRequest,NextResponse} from 'next/server';
import type {DB} from '../admin/auth';

export const PLATFORM_COOKIE='ci_platform_session';
export const HOTEL_COOKIE='ci_hotel_session';
export const noStore={'Cache-Control':'no-store'};
export function environment(){
 const e=getCloudflareContext().env as Record<string,unknown>;
 return {
 db:e.DB as DB|undefined,
 platformEmail:typeof e.PLATFORM_ADMIN_EMAIL==='string'?e.PLATFORM_ADMIN_EMAIL.toLowerCase().trim():'',
 platformPassword:typeof e.PLATFORM_ADMIN_PASSWORD==='string'?e.PLATFORM_ADMIN_PASSWORD:'',
 secret:typeof e.ADMIN_SESSION_SECRET==='string'?e.ADMIN_SESSION_SECRET:''
 };
}
export function originValid(req:NextRequest){
 const origin=req.headers.get('origin');
 if(!origin)return false;
 try{return new URL(origin).origin===new URL(req.url).origin}catch{return false}
}
export function platformConfigured(e:ReturnType<typeof environment>){
 return Boolean(e.db&&e.platformEmail&&e.platformPassword.length>=16&&new TextEncoder().encode(e.secret).length>=32);
}
export async function makeToken(secret:string,claims:{sub:string;role:string;hotelId?:string}){
 return new SignJWT(claims).setProtectedHeader({alg:'HS256'}).setIssuedAt().setIssuer('crystalinnstay-platform').setAudience('crystalinnstay-management').setExpirationTime('1h').sign(new TextEncoder().encode(secret));
}
export async function authorize(req:NextRequest,kind:'platform'|'hotel'){
 try{
  const e=environment();if(!e.db||new TextEncoder().encode(e.secret).length<32)
   return NextResponse.json({error:'Management database or security secret not configured.'},{status:503,headers:noStore});
  if(!['GET','HEAD'].includes(req.method)&&!originValid(req))
   return NextResponse.json({error:'Invalid origin.'},{status:403,headers:noStore});
  const token=req.cookies.get(kind==='platform'?PLATFORM_COOKIE:HOTEL_COOKIE)?.value;
  if(!token)throw Error('No session');
  const {payload}=await jwtVerify(token,new TextEncoder().encode(e.secret),{issuer:'crystalinnstay-platform',audience:'crystalinnstay-management',algorithms:['HS256']});
  if(typeof payload.sub!=='string'||payload.role!==(kind==='platform'?'platform_admin':'property_admin'))
   return NextResponse.json({error:'Insufficient permissions.'},{status:403,headers:noStore});
  if(kind==='platform'){
   if(!platformConfigured(e)||payload.sub!==e.platformEmail)return NextResponse.json({error:'Not authorized.'},{status:403,headers:noStore});
   return {db:e.db,email:payload.sub,hotelId:null};
  }
  if(typeof payload.hotelId!=='string')return NextResponse.json({error:'Hotel access required.'},{status:403,headers:noStore});
  const membership=await e.db.prepare(`SELECT h.id FROM hotels h JOIN hotel_admin_memberships m ON m.hotel_id=h.id
   JOIN hotel_admin_users u ON u.id=m.admin_user_id
   WHERE h.id=? AND h.status='active' AND u.email=? AND u.status='active' AND m.role='property_admin'`)
   .bind(payload.hotelId,payload.sub).first();
  if(!membership)return NextResponse.json({error:'Hotel access revoked or property inactive.'},{status:403,headers:noStore});
  return {db:e.db,email:payload.sub,hotelId:payload.hotelId};
 }catch{return NextResponse.json({error:'Sign in required or session expired.'},{status:401,headers:noStore});}
}
