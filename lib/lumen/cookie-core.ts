/**
 * Pure authentication-response validation helpers.
 * Never log or return a Lumen cookie in an API/guest-facing response.
 */
export type LumenCookie={name:string;value:string};
export function approvedLumenOrigin(baseUrl:string,allowHost:string):string {
 let url:URL;
 try{url=new URL(baseUrl)}catch{throw new Error('Lumen origin configuration is invalid')}
 const host=allowHost.trim().toLowerCase();
 if(!host||host.includes('/')||host.includes(':')||
    url.protocol!=='https:'||url.username||url.password||url.search||url.hash||
    url.pathname!=='/'||url.hostname.toLowerCase()!==host||url.port){
  throw new Error('Lumen origin is not explicitly approved')
 }
 return url.origin;
}
export function loginWasApproved(responseText:string):boolean{
 return responseText.trim()==='true';
}
export function readLumenAuthCookie(headers:Headers):LumenCookie {
 const lines=typeof headers.getSetCookie==='function'?headers.getSetCookie():[];
 const sources=lines.length?lines:[headers.get('set-cookie')||''];
 // The browser was seen using AppCookies. Preserve the exact cookie-name casing
 // seen in a valid Set-Cookie header; accept only that cookie and no others.
 for(const line of sources){
  // Workers may expose multiple Set-Cookie headers as one combined value.
  const re=/(?:^|,)\s*(AppCookies)=([^;,\s]+)/gi;
  for(const match of line.matchAll(re)){
   const name=match[1],value=match[2];
   if(/^chunks-\d+$/i.test(value))throw new Error('Lumen issued a chunked cookie; implement safe chunk handling');
   if(value.length<24||value.length>12000||! /^[A-Za-z0-9%_+=./~-]+$/.test(value))
    throw new Error('Lumen authentication cookie format is invalid');
   return {name,value};
  }
 }
 throw new Error('Lumen did not issue the approved authentication cookie');
}
