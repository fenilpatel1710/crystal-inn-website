import {NextRequest,NextResponse} from 'next/server';
import {guestEnv,guestConfigured,sameOrigin,validPhone,hotelActive,incrementLimit,twilioRequest,authError,guestHeaders} from '../../../../../../lib/guest/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(req:NextRequest){
 if(!sameOrigin(req))return authError('Invalid request origin.',403);
 const e=guestEnv();if(!guestConfigured(e)||!e.db)return authError('Guest sign-in is not available yet. SMS verification must be configured.',503);
 let data:{hotelId?:unknown;phone?:unknown};
 try{if(Number(req.headers.get('content-length')||0)>1000)return authError('Invalid request.',400);data=await req.json()}catch{return authError('Invalid request.',400)}
 const hotelId=typeof data.hotelId==='string'?data.hotelId:'';
 const phone=typeof data.phone==='string'?data.phone.trim():'';
 if(!hotelId||hotelId.length>120||!validPhone(phone))return authError('Select a hotel and enter a valid US phone number.',400);
 try{
  if(!await hotelActive(e.db,hotelId))return authError('Selected hotel is not available.',404);
  const ip=req.headers.get('cf-connecting-ip')||'unknown';
  const [byIp,byNumber]=await Promise.all([
   incrementLimit(e.db,e.pepper,'guest-otp-ip:'+ip,10,3600),
   incrementLimit(e.db,e.pepper,'guest-otp-number:'+hotelId+':'+phone,3,900)
  ]);
  if(!byIp||!byNumber)return authError('Too many code requests. Try again later.',429);
  const status=await twilioRequest(e,'Verifications',new URLSearchParams({To:phone,Channel:'sms'}));
  if(status!=='pending')return authError('Could not send verification. Try again later.',503);
  return NextResponse.json({ok:true,message:'If SMS delivery is available, a verification code has been sent.'},{headers:guestHeaders});
 }catch{return authError('Unable to send a verification code right now.',503)}
}
