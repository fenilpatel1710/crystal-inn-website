/**
 * NW290 Lumen cookie-auth pilot. No guest routes use this module.
 *
 * Lumen was observed to POST /api/UserAccount/SignIn with emailID/password,
 * respond with true, and issue an AppCookies browser session.
 * We reproduce ONLY that handshake using an approved integration account.
 *
 * Credentials are Worker secrets, not D1 fields or staff browser cookies.
 * Never return the resulting Set-Cookie header to Crystal Inn clients.
 */
import 'server-only';
import {getCloudflareContext} from '@opennextjs/cloudflare';
import type {DB} from '../admin/auth';
import {approvedLumenOrigin,loginWasApproved,readLumenAuthCookie} from './cookie-core';

const NW290='crystal-inn-northwest-290';
const PILOT_HOTEL_ID=4;
const SIGN_IN_PATH='/api/UserAccount/SignIn';

export class LumenCookieAuthError extends Error{
 constructor(public readonly reason:'disabled'|'unconfigured'|'unauthorized_hotel'|'upstream'|'invalid_response'){
  super('The authorized Lumen authentication test is unavailable.');this.name='LumenCookieAuthError';
 }
}
type Settings={
 origin:string;accountEmail:string;password:string;
};
function bindings(){
 return getCloudflareContext().env as unknown as Record<string,unknown>;
}
function value(e:Record<string,unknown>,key:string){
 return typeof e[key]==='string'?(e[key] as string).trim():'';
}
function pilotSettings(e:Record<string,unknown>):Settings{
 const base=value(e,'LUMEN_NW290_BASE_URL'),allow=value(e,'LUMEN_NW290_ALLOWED_HOST');
 const accountEmail=value(e,'LUMEN_NW290_SERVICE_EMAIL');
 const password=typeof e.LUMEN_NW290_SERVICE_PASSWORD==='string'?e.LUMEN_NW290_SERVICE_PASSWORD:'';
 if(!base||!allow||!accountEmail||!password||accountEmail.length>254||password.length>500)
  throw new LumenCookieAuthError('unconfigured');
 let origin:string;
 try{origin=approvedLumenOrigin(base,allow)}catch{throw new LumenCookieAuthError('unconfigured')}
 return {origin,accountEmail,password};
}
export function lumenPilotConfigurationState(hotelId:string){
 if(hotelId!==NW290)return {supported:false,enabled:false,configured:false};
 const e=bindings();
 const enabled=e.LUMEN_NW290_AUTH_TEST_ENABLED===true||
  value(e,'LUMEN_NW290_AUTH_TEST_ENABLED').toLowerCase()==='true';
 let configured=false;try{pilotSettings(e);configured=true}catch{}
 return {supported:true,enabled,configured};
}
export async function authenticateLumenPilot(
 db:DB,hotelId:string,fetcher:typeof fetch=fetch
):Promise<{hotelId:string,lumenHotelId:number,authenticated:true,databaseScopeVerified:false}> {
 if(hotelId!==NW290)throw new LumenCookieAuthError('unauthorized_hotel');
 const state=lumenPilotConfigurationState(hotelId);
 if(!state.enabled)throw new LumenCookieAuthError('disabled');
 const settings=pilotSettings(bindings());
 // Compare website HotelID with the documented PMS HotelID before sending
 // any credentials. This does NOT establish which PMS DB the cookie accessed.
 const record=await db.prepare(`SELECT lumen_hotel_id FROM hotels
   WHERE id=? AND status='active' AND archived_at IS NULL`)
  .bind(hotelId).first<{lumen_hotel_id:number|null}>();
 if(!record||record.lumen_hotel_id!==PILOT_HOTEL_ID)
  throw new LumenCookieAuthError('unauthorized_hotel');
 let response:Response;
 try{
  response=await fetcher(new URL(SIGN_IN_PATH,settings.origin),{
   method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},
   body:JSON.stringify({emailID:settings.accountEmail,password:settings.password}),
   redirect:'manual',cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(8000)
  });
 }catch{throw new LumenCookieAuthError('upstream')}
 if(!response.ok||response.status>=300)throw new LumenCookieAuthError('upstream');
 // Limit unexpected response sizes; never inspect/print response cookies.
 const raw=await response.text().catch(()=>{throw new LumenCookieAuthError('invalid_response')});
 if(raw.length>128||!loginWasApproved(raw))throw new LumenCookieAuthError('invalid_response');
 try{
  // Prove the login issued the expected cookie; do not persist it in D1, logs
  // or an HTTP response. A later approved adapter can use it within one call.
  readLumenAuthCookie(response.headers);
 }catch{throw new LumenCookieAuthError('invalid_response')}
 return {hotelId,lumenHotelId:PILOT_HOTEL_ID,authenticated:true,databaseScopeVerified:false};
}
