import {NextRequest,NextResponse} from 'next/server';
import {firebaseSettings} from '../../../../../../lib/guest/firebase';
import {guestEnv,sameOrigin,hotelActive,incrementLimit,validPhone,authError,guestHeaders} from '../../../../../../lib/guest/auth';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(req:NextRequest){
 if(!sameOrigin(req))return authError('Invalid request origin.',403);
 const settings=firebaseSettings();
 const e=guestEnv();
 if(settings.provider!=='firebase'||!settings.configured||!e.db||e.pepper.length<32)return authError('Guest phone verification is unavailable.',503);
 let body:{hotelId?:unknown;phone?:unknown};
 try{
  if(Number(req.headers.get('content-length')||0)>1000)return authError('Invalid request.',400);
  const raw=await req.text();if(raw.length>1000)return authError('Invalid request.',400);
  body=JSON.parse(raw);
 }catch{return authError('Invalid request.',400);}
 const hotelId=typeof body.hotelId==='string'?body.hotelId:'';
 const phone=typeof body.phone==='string'?body.phone:'';
 if(!hotelId||hotelId.length>120||!validPhone(phone))return authError('Choose a hotel and enter a valid US phone number.',400);
 try{
  if(!await hotelActive(e.db,hotelId))return authError('Hotel unavailable.',404);
  const ip=req.headers.get('cf-connecting-ip')||'unknown';
  const byIp=await incrementLimit(e.db,e.pepper,'firebase-preflight-ip:'+ip,10,3600);
  const byNumber=await incrementLimit(e.db,e.pepper,'firebase-preflight-phone:'+hotelId+':'+phone,3,3600);
  if(!byIp||!byNumber)return authError('Too many verification requests. Try later.',429);
  return NextResponse.json({ok:true},{headers:guestHeaders});
 }catch{return authError('Verification request temporarily unavailable.',503);}
}
