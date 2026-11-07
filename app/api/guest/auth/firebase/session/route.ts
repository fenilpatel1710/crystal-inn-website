import {NextRequest,NextResponse} from 'next/server';
import {firebaseSettings,verifyFirebasePhoneToken} from '../../../../../../lib/guest/firebase';
import {guestEnv,sameOrigin,hotelActive,incrementLimit,authError,guestHeaders,GUEST_COOKIE,hash,newSessionToken} from '../../../../../../lib/guest/auth';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(req:NextRequest){
 if(!sameOrigin(req))return authError('Invalid request origin.',403);
 const settings=firebaseSettings();
 const e=guestEnv();
 if(settings.provider!=='firebase'||!settings.configured||!e.db||e.pepper.length<32)return authError('Guest authentication unavailable.',503);
 let data:{hotelId?:unknown;idToken?:unknown};
 try{
  if(Number(req.headers.get('content-length')||0)>14000)return authError('Invalid request.',400);
  const raw=await req.text();if(raw.length>14000)return authError('Invalid request.',400);
  data=JSON.parse(raw);
 }catch{return authError('Invalid request.',400);}
 const hotelId=typeof data.hotelId==='string'?data.hotelId:'';
 const idToken=typeof data.idToken==='string'?data.idToken:'';
 if(!hotelId||hotelId.length>120||!idToken)return authError('Missing hotel or verification.',400);
 try{
  const ip=req.headers.get('cf-connecting-ip')||'unknown';
  if(!await incrementLimit(e.db,e.pepper,'firebase-session-ip:'+ip,30,3600))return authError('Too many attempts.',429);
  if(!await hotelActive(e.db,hotelId))return authError('Selected hotel unavailable.',404);
  // Firebase ID token must be signed by Google, intended for this exact project,
  // authenticated using the phone provider and recently verified.
  const verified=await verifyFirebasePhoneToken(idToken,settings.projectId);
  if(!await incrementLimit(e.db,e.pepper,'firebase-session-phone:'+hotelId+':'+verified.phone,15,3600))
   return authError('Too many attempts for this account.',429);
  // Reuse the existing verified phone record within ONLY the selected hotel.
  // This does not grant permission to link or reveal Lumen PMS data.
  await e.db.prepare('INSERT OR IGNORE INTO portal_guest_users(id,hotel_id,phone_e164) VALUES(?,?,?)')
   .bind(crypto.randomUUID(),hotelId,verified.phone).run();
  const user=await e.db.prepare('SELECT id FROM portal_guest_users WHERE hotel_id=? AND phone_e164=?')
   .bind(hotelId,verified.phone).first<{id:string}>();
  if(!user)return authError('Unable to establish guest account.',503);
  const existing=req.cookies.get(GUEST_COOKIE)?.value;
  if(existing&&existing.length>=30&&existing.length<=100)
   await e.db.prepare('DELETE FROM portal_guest_sessions WHERE token_hash=?').bind(hash(existing)).run().catch(()=>{});
  const sessionToken=newSessionToken();
  await e.db.prepare('INSERT INTO portal_guest_sessions(token_hash,user_id,hotel_id,expires_at) VALUES(?,?,?,?)')
   .bind(hash(sessionToken),user.id,hotelId,Math.floor(Date.now()/1000)+604800).run();
  const response=NextResponse.json({ok:true,hotelId},{headers:guestHeaders});
  response.cookies.set(GUEST_COOKIE,sessionToken,{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:604800});
  return response;
 }catch(error){
  if(error instanceof Error&&/Firebase token|Firebase signing|Unrecognized Firebase|authentication|JWT|signature|expiration|Unexpected signing|Invalid Compact/.test(error.message))
   return authError('Phone verification expired or invalid. Sign in again.',401);
  console.error('[firebase-guest] session creation unavailable',{type:error instanceof Error?error.name:'unknown'});
  return authError('Unable to sign in right now.',503);
 }
}
