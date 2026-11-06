/**
 * Google Workspace Gmail API transactional sender.
 * Authorization uses a single, deliberately provisioned Workspace sending
 * mailbox, offline OAuth, and the least-privilege gmail.send scope.
 *
 * All OAuth materials are encrypted Cloudflare Worker secrets. Do NOT
 * expose the refresh token in a browser, upload it to GitHub, or store in D1.
 */
import 'server-only';

const emailPattern=/^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/;
const get=(e:Record<string,unknown>,key:string)=>typeof e[key]==='string'?(e[key] as string).trim():'';
function validAddress(email:string){return email.length<=190&&emailPattern.test(email)}
export function googleWorkspaceMailConfigured(e:Record<string,unknown>):boolean{
 const enabled=e.GOOGLE_WORKSPACE_EMAIL_ENABLED===true||
  get(e,'GOOGLE_WORKSPACE_EMAIL_ENABLED').toLowerCase()==='true';
 return enabled&&validAddress(get(e,'GOOGLE_WORKSPACE_FROM_EMAIL'))&&
  Boolean(get(e,'GOOGLE_WORKSPACE_OAUTH_CLIENT_ID')&&
   get(e,'GOOGLE_WORKSPACE_OAUTH_CLIENT_SECRET')&&
   get(e,'GOOGLE_WORKSPACE_OAUTH_REFRESH_TOKEN'));
}
type MailRequest={to:string;subject:string;text:string;replyTo?:string};
export type GoogleMailSend={accepted:boolean;messageId?:string;errorCode?:string;uncertain?:boolean};
function emailRaw(from:string,to:string,subject:string,body:string,replyTo?:string):string {
 if(!validAddress(from)||!validAddress(to)||!subject||subject.length>220||
  /[\r\n]/.test(subject)||body.length>25000||(replyTo&&!validAddress(replyTo)))
  throw new Error('Invalid outgoing mail');
 const encodedSubject='=?UTF-8?B?'+Buffer.from(subject,'utf8').toString('base64')+'?=';
 const base64Body=Buffer.from(body,'utf8').toString('base64').match(/.{1,76}/g)?.join('\r\n')||'';
 const lines=[
  'From: <'+from+'>','To: <'+to+'>','Subject: '+encodedSubject,
  ...(replyTo?['Reply-To: <'+replyTo+'>']:[]),
  'MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8',
  'Content-Transfer-Encoding: base64','',''+base64Body
 ];
 return Buffer.from(lines.join('\r\n'),'utf8').toString('base64url');
}
export async function sendGoogleWorkspaceMail(e:Record<string,unknown>,message:MailRequest):Promise<GoogleMailSend>{
 if(!googleWorkspaceMailConfigured(e))return {accepted:false,errorCode:'google_mail_unconfigured'};
 const from=get(e,'GOOGLE_WORKSPACE_FROM_EMAIL');
 let raw:string;
 try{raw=emailRaw(from,message.to,message.subject,message.text,message.replyTo)}
 catch{return {accepted:false,errorCode:'invalid_mail_fields'}}
 let accessToken:string;
 try{
  const token=await fetch('https://oauth2.googleapis.com/token',{
   method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},
   body:new URLSearchParams({
    client_id:get(e,'GOOGLE_WORKSPACE_OAUTH_CLIENT_ID'),
    client_secret:get(e,'GOOGLE_WORKSPACE_OAUTH_CLIENT_SECRET'),
    refresh_token:get(e,'GOOGLE_WORKSPACE_OAUTH_REFRESH_TOKEN'),
    grant_type:'refresh_token'
   }).toString(),redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(8000)
  });
  if(!token.ok)return {accepted:false,errorCode:'google_token_http_'+token.status};
  const info=await token.json() as {access_token?:unknown;token_type?:unknown};
  if(typeof info.access_token!=='string'||info.access_token.length<20)
   return {accepted:false,errorCode:'google_token_invalid'};
  accessToken=info.access_token;
 }catch{return {accepted:false,errorCode:'google_token_unavailable'}}
 try{
  // Gmail users.messages.send returns an id only after Gmail accepts a send.
  // Gmail does not provide an idempotency key. Any network-uncertain outcome
  // must be reconciled in Gmail Sent before manually retrying.
  const response=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{
   method:'POST',headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json',Accept:'application/json'},
   body:JSON.stringify({raw}),redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(10000)
  });
  if(!response.ok){
   return {accepted:false,errorCode:'gmail_send_http_'+response.status,
    uncertain:response.status>=500||response.status===429};
  }
  const result=await response.json() as {id?:unknown};
  if(typeof result.id==='string'&&result.id.length>5&&result.id.length<200){
   return {accepted:true,messageId:result.id};
  }
  return {accepted:false,errorCode:'gmail_missing_message_id',uncertain:true};
 }catch{return {accepted:false,errorCode:'gmail_network_uncertain',uncertain:true}}
}
