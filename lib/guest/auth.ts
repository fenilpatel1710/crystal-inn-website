import 'server-only';
import {createHash,randomBytes} from 'node:crypto';
import {getCloudflareContext} from '@opennextjs/cloudflare';
import {NextRequest,NextResponse} from 'next/server';
import type {DB} from '../admin/auth';

export const GUEST_COOKIE='ci_guest_session';
export const guestHeaders={'Cache-Control':'no-store'};
export function guestEnv(){
 const env=getCloudflareContext().env as unknown as Record<string,unknown>;
 const get=(key:string)=>typeof env[key]==='string'?env[key] as string:'';
 return {
  db:env.DB as DB|undefined,
  enabled:get('GUEST_OTP_ENABLED')==='true',
  service:get('TWILIO_VERIFY_SERVICE_SID'),
  apiKey:get('TWILIO_API_KEY'),
  apiSecret:get('TWILIO_API_SECRET'),
  pepper:get('GUEST_AUTH_PEPPER')
 };
}
export function guestConfigured(e:ReturnType<typeof guestEnv>){
 return Boolean(e.db&&e.enabled&&/^VA[0-9a-f]{32}$/i.test(e.service)&&e.apiKey&&e.apiSecret&&e.pepper.length>=32);
}
export function sameOrigin(req:NextRequest){
 const origin=req.headers.get('origin');
 if(!origin)return false;
 try{return new URL(origin).origin===new URL(req.url).origin}catch{return false}
}
export function validPhone(phone:string){
 // Restrict initial pilot to North American numbering; expand only after SMS risk review.
 return /^\+1[2-9]\d{2}[2-9]\d{6}$/.test(phone);
}
export function authError(message:string,status:number){
 return NextResponse.json({error:message},{status,headers:guestHeaders});
}
export function hash(value:string){return createHash('sha256').update(value).digest('hex')}
export function newSessionToken(){return randomBytes(32).toString('base64url')}
export async function hotelActive(db:DB,hotelId:string){
 return db.prepare("SELECT id,display_name FROM hotels WHERE id=? AND status='active' AND archived_at IS NULL")
  .bind(hotelId).first<{id:string;display_name:string}>();
}
export async function incrementLimit(db:DB,pepper:string,key:string,max:number,windowSeconds:number){
 const now=Math.floor(Date.now()/1000),id=hash(pepper+':'+key);
 await db.prepare(`INSERT INTO portal_guest_login_rate_limits(key_hash,window_start,attempt_count)
   VALUES(?,?,1) ON CONFLICT(key_hash) DO UPDATE SET
   attempt_count=CASE WHEN excluded.window_start-window_start>=? THEN 1 ELSE attempt_count+1 END,
   window_start=CASE WHEN excluded.window_start-window_start>=? THEN excluded.window_start ELSE window_start END`)
  .bind(id,now,windowSeconds,windowSeconds).run();
 const row=await db.prepare('SELECT attempt_count FROM portal_guest_login_rate_limits WHERE key_hash=?')
  .bind(id).first<{attempt_count:number}>();
 return Boolean(row&&row.attempt_count<=max);
}
export async function twilioRequest(e:ReturnType<typeof guestEnv>,endpoint:'Verifications'|'VerificationCheck',params:URLSearchParams){
 const url='https://verify.twilio.com/v2/Services/'+encodeURIComponent(e.service)+'/'+endpoint;
 const basic=Buffer.from(e.apiKey+':'+e.apiSecret).toString('base64');
 const response=await fetch(url,{
  method:'POST',headers:{Authorization:'Basic '+basic,'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},
  // Workers does not support redirect: 'error'; that option throws a TypeError
  // before Twilio receives any request. Use manual handling and reject 3xx.
  body:params.toString(),redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(8000)
 });
 if(response.status>=300&&response.status<400){
  console.error('[guest-verify] unexpected Twilio redirect',{endpoint,status:response.status});
  throw new Error('Twilio Verify unexpectedly redirected the request.');
 }
 if(!response.ok){
  // Log only non-sensitive diagnostic fields. Never log phone numbers, tokens,
  // API credentials, message bodies or Twilio's full error description.
  let code:number|undefined;
  try{
   const error=await response.json() as {code?:unknown};
   if(typeof error.code==='number'&&Number.isInteger(error.code))code=error.code;
  }catch{}
  console.error('[guest-verify] provider rejected request',{endpoint,status:response.status,code});
  throw new Error('Twilio Verify returned HTTP '+response.status);
 }
 const data=await response.json() as {status?:string};
 return data.status;
}
export async function guestSession(req:NextRequest){
 const e=guestEnv();
 if(!e.db)return null;
 const token=req.cookies.get(GUEST_COOKIE)?.value;
 if(!token||token.length<30||token.length>100)return null;
 try{
  const row=await e.db.prepare(`SELECT s.user_id,s.hotel_id,u.phone_e164,h.display_name
   FROM portal_guest_sessions s
   JOIN portal_guest_users u ON u.id=s.user_id AND u.hotel_id=s.hotel_id
   JOIN hotels h ON h.id=s.hotel_id AND h.status='active' AND h.archived_at IS NULL
   WHERE s.token_hash=? AND s.expires_at>?`)
   .bind(hash(token),Math.floor(Date.now()/1000))
   .first<{user_id:string;hotel_id:string;phone_e164:string;display_name:string}>();
  return row;
 }catch{return null}
}
