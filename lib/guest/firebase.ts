import 'server-only';
import {getCloudflareContext} from '@opennextjs/cloudflare';
import {importX509,jwtVerify,decodeProtectedHeader} from 'jose';
import {validPhone} from './auth';

type FirebaseClaims={
  sub?:string;phone_number?:string;auth_time?:number;
  firebase?:{sign_in_provider?:string};
};
const CERTS_URL='https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let cachedCerts:Record<string,string>|null=null;
let certsExpire=0;

export function firebaseSettings(){
 const raw=getCloudflareContext().env as unknown as Record<string,unknown>;
 const read=(name:string)=>typeof raw[name]==='string'?(raw[name] as string).trim():'';
 const provider=read('GUEST_AUTH_PROVIDER').toLowerCase()==='firebase'?'firebase':'twilio';
 const projectId=read('FIREBASE_PROJECT_ID');
 const apiKey=read('FIREBASE_API_KEY');
 const authDomain=read('FIREBASE_AUTH_DOMAIN');
 const appId=read('FIREBASE_APP_ID');
 const configured=Boolean(projectId&&apiKey&&authDomain&&appId&&/^[a-z0-9-]+$/.test(projectId));
 return {provider,configured,projectId,apiKey,authDomain,appId};
}
export async function verifyFirebasePhoneToken(idToken:string,projectId:string){
 if(idToken.length<100||idToken.length>10000)throw Error('Invalid Firebase token');
 const header=decodeProtectedHeader(idToken);
 if(header.alg!=='RS256'||typeof header.kid!=='string'||!header.kid)throw Error('Unexpected signing key');
 const now=Date.now();
 if(!cachedCerts||now>=certsExpire||!Object.prototype.hasOwnProperty.call(cachedCerts,header.kid)){
  const response=await fetch(CERTS_URL,{redirect:'manual',signal:AbortSignal.timeout(7000)});
  if(!response.ok)throw Error('Unable to obtain Firebase signing keys');
  const data=await response.json() as Record<string,unknown>;
  const certificates:Record<string,string>={};
  for(const [kid,pem] of Object.entries(data))if(typeof pem==='string'&&pem.includes('BEGIN CERTIFICATE'))certificates[kid]=pem;
  if(!Object.keys(certificates).length)throw Error('No Firebase signing keys');
  const age=/max-age=(\d+)/.exec(response.headers.get('cache-control')||'');
  cachedCerts=certificates;
  certsExpire=now+Math.min(Math.max(Number(age?.[1]||300),60),3600)*1000;
 }
 const pem=cachedCerts[header.kid];
 if(!pem)throw Error('Unrecognized Firebase signing key');
 const publicKey=await importX509(pem,'RS256');
 const {payload}=await jwtVerify(idToken,publicKey,{
  algorithms:['RS256'],
  audience:projectId,
  issuer:'https://securetoken.google.com/'+projectId,
  clockTolerance:5
 });
 const claims=payload as FirebaseClaims;
 const issued=claims.auth_time;
 const nowSeconds=Math.floor(Date.now()/1000);
 if(!claims.sub||claims.sub.length>128||!claims.phone_number||!validPhone(claims.phone_number)||
   claims.firebase?.sign_in_provider!=='phone'||typeof issued!=='number'||
   issued>nowSeconds+5||nowSeconds-issued>600){
  throw Error('Phone authentication is missing or no longer recent');
 }
 return {uid:claims.sub,phone:claims.phone_number};
}
