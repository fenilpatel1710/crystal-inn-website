import {NextRequest,NextResponse} from 'next/server';
import {guestEnv,guestConfigured,sameOrigin,validPhone,hotelActive,incrementLimit,twilioRequest,authError,guestHeaders} from '../../../../../../lib/guest/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(req:NextRequest){
 if(!sameOrigin(req))return authError('Invalid request origin.',403);
 const e=guestEnv();
 if(!guestConfigured(e)||!e.db){
  // Diagnostic flags only: never print SID, keys, pepper, phone or request payload.
  console.error('[guest-verify] configuration validation failed',{
   dbBindingPresent:Boolean(e.db),
   guestOtpEnabled:e.enabled,
   verifyServiceSidFormatValid:/^VA[0-9a-f]{32}$/i.test(e.service),
   apiKeyPresent:Boolean(e.apiKey),
   apiSecretPresent:Boolean(e.apiSecret),
   authPepperLengthValid:e.pepper.length>=32
  });
  return authError('Guest sign-in is not available yet. SMS verification must be configured.',503);
 }
 let data:{hotelId?:unknown;phone?:unknown};
 try{if(Number(req.headers.get('content-length')||0)>1000)return authError('Invalid request.',400);data=await req.json()}catch{return authError('Invalid request.',400)}
 const hotelId=typeof data.hotelId==='string'?data.hotelId:'';
 const phone=typeof data.phone==='string'?data.phone.trim():'';
 if(!hotelId||hotelId.length>120||!validPhone(phone))return authError('Select a hotel and enter a valid US phone number.',400);
 let byIp:boolean,byNumber:boolean;
 try{
  if(!await hotelActive(e.db,hotelId))return authError('Selected hotel is not available.',404);
  const ip=req.headers.get('cf-connecting-ip')||'unknown';
  // D1 rate-limit writes are sequential to avoid competing writes per request.
  byIp=await incrementLimit(e.db,e.pepper,'guest-otp-ip:'+ip,10,3600);
  byNumber=await incrementLimit(e.db,e.pepper,'guest-otp-number:'+hotelId+':'+phone,3,900);
 }catch(error){
  console.error('[guest-verify] D1 lookup or rate-limit query failed',{type:error instanceof Error?error.name:'unknown'});
  return authError('Guest login database check failed. Verify migration 009 and the DB binding.',503);
 }
 if(!byIp||!byNumber)return authError('Too many code requests. Try again later.',429);
 try{
  const status=await twilioRequest(e,'Verifications',new URLSearchParams({To:phone,Channel:'sms'}));
  if(status!=='pending'){
   console.error('[guest-verify] unexpected provider verification state');
   return authError('Twilio did not start the SMS verification. Check Verify logs.',503);
  }
  return NextResponse.json({ok:true,message:'A verification code has been requested.'},{headers:guestHeaders});
 }catch(error){
  console.error('[guest-verify] SMS request failed',{type:error instanceof Error?error.name:'unknown'});
  return authError('Twilio could not send the verification code. Check Twilio Verify logs and Cloudflare Worker logs.',503);
 }
}
