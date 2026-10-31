/**
 * Authenticated HOTEL ADMIN ONLY. Never accessible to guests.
 * POST validates the Lumen cookie handshake only. It never returns cookies,
 * passwords, guest records, scanned IDs, or Lumen raw responses.
 */
import {NextRequest,NextResponse} from 'next/server';
import {authorize,noStore} from '../../../../../lib/platform/auth';
import {guestEnv,incrementLimit} from '../../../../../lib/guest/auth';
import {authenticateLumenPilot,lumenPilotConfigurationState,LumenCookieAuthError} from '../../../../../lib/lumen/cookie-auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const a=await authorize(req,'hotel');if(a instanceof NextResponse)return a;
 return NextResponse.json({
  hotelId:a.hotelId,...lumenPilotConfigurationState(a.hotelId),
  connectionVerified:false,databaseScopeVerified:false,
  note:'This is a disabled-by-default authentication test, not live guest sync.'
 },{headers:noStore});
}
export async function POST(req:NextRequest){
 const a=await authorize(req,'hotel');if(a instanceof NextResponse)return a;
 if(a.hotelId!=='crystal-inn-northwest-290')return NextResponse.json({error:'No approved integration pilot for this hotel.'},{status:403,headers:noStore});
 const state=lumenPilotConfigurationState(a.hotelId);
 if(!state.enabled||!state.configured)return NextResponse.json({error:'Lumen authentication test not enabled or configured by the developer.'},{status:503,headers:noStore});
 try{
  const e=guestEnv();
  if(!e.pepper||e.pepper.length<32)return NextResponse.json({error:'Lumen diagnostic throttling is not configured.'},{status:503,headers:noStore});
  // D1-backed limit across Cloudflare instances: three tests per hotel-admin
  // user per 15 minutes. Reuses migration 0009's generic hash-key counter.
  const permitted=await incrementLimit(a.db,e.pepper,'lumen-auth-test:'+a.hotelId+':'+a.email,3,900);
  if(!permitted)return NextResponse.json({error:'Too many connection tests. Retry later.'},{status:429,headers:noStore});
  const result=await authenticateLumenPilot(a.db,a.hotelId);
  return NextResponse.json({
   status:'authenticated_cookie_received',hotelId:result.hotelId,
   lumenHotelId:result.lumenHotelId,databaseScopeVerified:false,
   note:'Login succeeded; the Lumen developer must still prove the session is bound to this property database.'
  },{headers:noStore});
 }catch(err){
  if(err instanceof LumenCookieAuthError){
   // Do not reveal upstream cookie/auth data.
   return NextResponse.json({error:'Lumen login test could not be verified. Check dedicated integration account, approved host and server logs.'},{status:502,headers:noStore});
  }
  return NextResponse.json({error:'Lumen authentication test temporarily unavailable.'},{status:503,headers:noStore});
 }
}
