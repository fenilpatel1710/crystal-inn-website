import {NextRequest,NextResponse} from 'next/server';
import {guestEnv,guestConfigured,sameOrigin,validPhone,hotelActive,incrementLimit,twilioRequest,authError,guestHeaders,GUEST_COOKIE,hash,newSessionToken} from '../../../../../../lib/guest/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(req:NextRequest){
 if(!sameOrigin(req))return authError('Invalid request origin.',403);
 const e=guestEnv();if(!guestConfigured(e)||!e.db)return authError('Guest login is not configured.',503);
 let data:{hotelId?:unknown;phone?:unknown;code?:unknown};
 try{if(Number(req.headers.get('content-length')||0)>1000)return authError('Invalid request.',400);data=await req.json()}catch{return authError('Invalid request.',400)}
 const hotelId=typeof data.hotelId==='string'?data.hotelId:'';
 const phone=typeof data.phone==='string'?data.phone.trim():'';
 const code=typeof data.code==='string'?data.code.trim():'';
 if(hotelId.length<1||hotelId.length>120||!validPhone(phone)||!/^\d{4,10}$/.test(code))return authError('Invalid phone number or code.',400);
 try{
  if(!await hotelActive(e.db,hotelId))return authError('Selected hotel is not available.',404);
  const ip=req.headers.get('cf-connecting-ip')||'unknown';
  const [byIp,byPhone]=await Promise.all([
   incrementLimit(e.db,e.pepper,'guest-verify-ip:'+ip,30,3600),
   incrementLimit(e.db,e.pepper,'guest-verify-number:'+hotelId+':'+phone,6,900)
  ]);
  if(!byIp||!byPhone)return authError('Too many attempts. Request a new code later.',429);
  const status=await twilioRequest(e,'VerificationCheck',new URLSearchParams({To:phone,Code:code}));
  if(status!=='approved')return authError('Invalid or expired verification code.',401);
  const newUserId=crypto.randomUUID();
  await e.db.prepare('INSERT OR IGNORE INTO portal_guest_users(id,hotel_id,phone_e164) VALUES(?,?,?)')
   .bind(newUserId,hotelId,phone).run();
  const user=await e.db.prepare('SELECT id FROM portal_guest_users WHERE hotel_id=? AND phone_e164=?')
   .bind(hotelId,phone).first<{id:string}>();
  if(!user)return authError('Unable to establish guest account.',503);
  const token=newSessionToken();
  await e.db.prepare('INSERT INTO portal_guest_sessions(token_hash,user_id,hotel_id,expires_at) VALUES(?,?,?,?)')
   .bind(hash(token),user.id,hotelId,Math.floor(Date.now()/1000)+604800).run();
  const response=NextResponse.json({ok:true,hotelId},{headers:guestHeaders});
  response.cookies.set(GUEST_COOKIE,token,{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:604800});
  return response;
 }catch{return authError('Unable to verify this code right now.',503)}
}
