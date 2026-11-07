'use client';
import {useEffect,useId,useRef,useState,type FormEvent} from 'react';
import {initializeApp,getApps,type FirebaseOptions} from 'firebase/app';
import {getAuth,RecaptchaVerifier,signInWithPhoneNumber,setPersistence,browserSessionPersistence,signOut,type ConfirmationResult} from 'firebase/auth';

export type FirebaseWebConfig={apiKey:string;authDomain:string;projectId:string;appId:string};
type Props={hotelId:string;config:FirebaseWebConfig;onAuthenticated:()=>Promise<void>};

function phoneE164(input:string){
 const digits=input.replace(/\D/g,'');
 return digits.length===10?'+1'+digits:digits.length===11&&digits.startsWith('1')?'+'+digits:'';
}
export default function FirebasePhoneLogin({hotelId,config,onAuthenticated}:Props){
 const captchaId='ci-firebase-captcha-'+useId().replace(/[^a-zA-Z0-9_-]/g,'');
 const [phone,setPhone]=useState('');
 const [code,setCode]=useState('');
 const [step,setStep]=useState<'phone'|'code'>('phone');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');
 const confirmation=useRef<ConfirmationResult|null>(null);
 const verifier=useRef<RecaptchaVerifier|null>(null);
 useEffect(()=>()=>{try{verifier.current?.clear()}catch{}},[]);
 const setupAuth=async()=>{
  const options:FirebaseOptions={apiKey:config.apiKey,authDomain:config.authDomain,projectId:config.projectId,appId:config.appId};
  const app=getApps().find(a=>a.name==='crystal-inn-guest')||initializeApp(options,'crystal-inn-guest');
  const auth=getAuth(app);
  await setPersistence(auth,browserSessionPersistence);
  return auth;
 };
 async function post(url:string,payload:Record<string,unknown>){
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),cache:'no-store'});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(data.error||'Please try again.');
  return data;
 }
 async function sendCode(e:FormEvent){
  e.preventDefault();setError('');setMessage('');
  const normalized=phoneE164(phone);
  if(!hotelId){setError('Select your hotel first.');return}
  if(!/^\+1[2-9]\d{2}[2-9]\d{6}$/.test(normalized)){setError('Enter a valid US mobile number.');return}
  setBusy(true);
  try{
   // Preflight is a supplemental cost control; Firebase reCAPTCHA and
   // the Firebase SMS region policy must also remain enabled.
   await post('/api/guest/auth/firebase/preflight',{hotelId,phone:normalized});
   const auth=await setupAuth();
   if(!verifier.current){
    verifier.current=new RecaptchaVerifier(auth,captchaId,{size:'normal'});
    await verifier.current.render();
   }
   confirmation.current=await signInWithPhoneNumber(auth,normalized,verifier.current);
   setStep('code');
   setMessage('We sent a verification code. Check your phone.');
  }catch(ex){
   setError(ex instanceof Error?ex.message:'Unable to send a verification code.');
   try{verifier.current?.clear()}catch{}
   verifier.current=null;
  }finally{setBusy(false)}
 }
 async function confirmCode(e:FormEvent){
  e.preventDefault();setError('');setMessage('');
  if(!confirmation.current){setError('Request a new verification code.');return}
  setBusy(true);
  try{
   const result=await confirmation.current.confirm(code.trim());
   const idToken=await result.user.getIdToken();
   await post('/api/guest/auth/firebase/session',{hotelId,idToken});
   // We keep only the website's secure HttpOnly session cookie, not a
   // lasting Firebase browser login on a shared lobby computer.
   await signOut(await setupAuth()).catch(()=>{});
   setCode('');setMessage('Phone verified.');
   await onAuthenticated();
  }catch(ex){setError(ex instanceof Error?ex.message:'Invalid or expired code.')}
  finally{setBusy(false)}
 }
 return <div className="ci-firebase-login">
  <p className="ci-guest-selected">Verify your mobile number with a one-time code. Your hotel account stays separate from other properties.</p>
  <form onSubmit={step==='phone'?sendCode:confirmCode}>
   <label>Mobile phone number
    <input type="tel" autoComplete="tel-national" required placeholder="(555) 555-0123" disabled={busy||step==='code'} value={phone} onChange={e=>setPhone(e.target.value)}/>
   </label>
   {step==='phone'&&<div><p className="ci-guest-disclaimer">Complete the security check below before requesting your code. SMS charges may apply to the hotel.</p><div id={captchaId}/></div>}
   {step==='code'&&<label>Verification code
    <input type="text" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" maxLength={6} required placeholder="6-digit code" value={code} disabled={busy} onChange={e=>setCode(e.target.value)}/>
   </label>}
   {error&&<p className="ci-guest-error" role="alert">{error}</p>}
   {message&&<p className="ci-guest-notice" role="status">{message}</p>}
   <button type="submit" disabled={busy||!hotelId}>{busy?'Please wait…':step==='code'?'Verify & sign in':'Send verification code'}</button>
   {step==='code'&&<button type="button" className="ci-guest-secondary" disabled={busy} onClick={()=>{confirmation.current=null;try{verifier.current?.clear()}catch{}verifier.current=null;setStep('phone');setCode('');setError('');setMessage('')}}>Use another number</button>}
  </form>
  <p className="ci-guest-disclaimer">Your phone is verified online. Government-issued ID is checked at the front desk, not uploaded here.</p>
 </div>;
}
