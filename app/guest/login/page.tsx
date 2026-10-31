'use client';
import {useEffect,useState,type FormEvent} from 'react';
import Link from 'next/link';
import './guest-login.css';

type Hotel={id:string;slug:string;display_name:string;city:string;region:string};
type Session={authenticated:boolean;hotelId?:string;hotelName?:string;phone?:string;
 profile?:{firstName:string;lastName:string;email:string}|null;
 profileSetupPending?:boolean;existingPmsLinkVerified?:boolean;pmsConnected?:boolean;};
type Step='phone'|'code';
export default function GuestLogin(){
 const [hotels,setHotels]=useState<Hotel[]>([]);
 const [hotelId,setHotelId]=useState('');
 const [phone,setPhone]=useState('');
 const [code,setCode]=useState('');
 const [step,setStep]=useState<Step>('phone');
 const [session,setSession]=useState<Session|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{
  let alive=true;
  Promise.all([
   fetch('/api/public/hotels',{cache:'no-store'}).then(r=>r.json()).catch(()=>({hotels:[]})),
   fetch('/api/guest/me',{cache:'no-store'}).then(r=>r.json()).catch(()=>({authenticated:false}))
  ]).then(([h,s])=>{
   if(!alive)return;
   const list=Array.isArray(h.hotels)?h.hotels as Hotel[]:[];
   setHotels(list);
   const preselected=new URLSearchParams(window.location.search).get('hotel');
   const match=list.find(v=>v.id===preselected||v.slug===preselected);
   if(match)setHotelId(match.id);
   setSession(s);
  }).finally(()=>{if(alive)setLoading(false)});
  return()=>{alive=false};
 },[]);
 function normalizedPhone(){
  const digits=phone.replace(/\D/g,'');
  if(digits.length===10)return '+1'+digits;
  if(digits.length===11&&digits.startsWith('1'))return '+'+digits;
  return '';
 }
 async function post(url:string,body:Record<string,unknown>){
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||'Request failed.');
  return data;
 }
 async function sendCode(e:FormEvent){
  e.preventDefault();setBusy(true);setError('');setNotice('');
  const p=normalizedPhone();if(!p){setBusy(false);setError('Enter a valid US phone number.');return}
  try{
   await post('/api/guest/auth/otp/request',{hotelId,phone:p});
   setStep('code');setNotice('Verification code requested. Check your phone.');
  }catch(e){setError(e instanceof Error?e.message:'SMS verification is unavailable.')}
  finally{setBusy(false)}
 }
 async function verifyCode(e:FormEvent){
  e.preventDefault();setBusy(true);setError('');setNotice('');
  try{
   await post('/api/guest/auth/otp/verify',{hotelId,phone:normalizedPhone(),code});
   const response=await fetch('/api/guest/me',{cache:'no-store'});
   const data=await response.json();setSession(data);
   setCode('');setNotice('Phone verified. You are signed in to your Crystal Inn guest account.');
  }catch(e){setError(e instanceof Error?e.message:'Unable to verify code.')}
  finally{setBusy(false)}
 }
 async function logout(){
  setBusy(true);setError('');
  try{await post('/api/guest/logout',{});setSession({authenticated:false});setStep('phone');setCode('');setNotice('Signed out.')}
  catch(e){setError(e instanceof Error?e.message:'Unable to sign out.')}
  finally{setBusy(false)}
 }
 const selected=hotels.find(h=>h.id===hotelId);
 return <main className="ci-guest-login">
  <header className="ci-guest-header"><Link href="/" className="ci-guest-brand"><img src="/crystal-inn-logo.svg" width={44} height={44} alt="Crystal Inn"/>CRYSTAL INN <span>GUEST ACCESS</span></Link><Link href="/#find-hotels">Explore hotels</Link></header>
  <div className="ci-guest-wrap">
   <p className="ci-guest-eyebrow">MY CRYSTAL INN</p>
   <h1>Guest sign in</h1>
   <p className="ci-guest-lead">Choose your hotel and verify your mobile number to access your own guest account. Existing Lumen stays and rewards appear only after your identity is securely linked.</p>
   {loading?<p>Loading guest access…</p>:session?.authenticated?<section className="ci-guest-card">
    <p className="ci-guest-eyebrow">SIGNED IN</p><h2>Welcome to {session.hotelName}</h2>
    <p>Verified mobile: <strong>{session.phone?.replace(/.(?=.{4})/g,'•')}</strong></p>
    {session.profile?<div className="ci-guest-pending">
      <strong>Your saved guest details</strong>
      <p>{session.profile.firstName} {session.profile.lastName}</p>
      <p>{session.profile.email}</p>
      <p>These details came from your verified Crystal Inn website reservation request. They are not an unverified Lumen guest profile.</p>
    </div>:<div className="ci-guest-pending"><strong>Welcome to Crystal Inn</strong>
      <p>No website profile has been saved yet. Complete your first reservation request to save your contact details for future visits.</p>
    </div>}
    <p><Link href="/book">Request a stay / complete guest details</Link></p>
    <div className="ci-guest-pending"><strong>{session.existingPmsLinkVerified?'Existing PMS guest link verified':'Existing Lumen guest link not verified'}</strong>
      <p>Lumen stay history, receipts and reward points will appear only after a secure, authorized property integration is live. We will not match or reveal records from a phone number alone.</p>
      <p>Bring government-issued photo ID to the front desk at check-in for staff verification/scanning. Do not upload an ID on this page.</p>
    </div>
    <button type="button" onClick={()=>void logout()} disabled={busy}>Sign out</button>
   </section>:<section className="ci-guest-card">
    <form onSubmit={step==='phone'?sendCode:verifyCode}>
     <label>Hotel property<select required disabled={busy||step==='code'} value={hotelId} onChange={e=>{setHotelId(e.target.value);setError('');setNotice('')}}><option value="">Select your hotel</option>{hotels.map(h=><option key={h.id} value={h.id}>{h.display_name} — {h.city}, {h.region}</option>)}</select></label>
     {selected&&<p className="ci-guest-selected">Guest access for <strong>{selected.display_name}</strong></p>}
     <label>Mobile phone number<input required autoComplete="tel-national" type="tel" placeholder="(555) 555-0123" value={phone} onChange={e=>setPhone(e.target.value)} disabled={busy||step==='code'}/></label>
     {step==='code'&&<label>SMS verification code<input autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{4,10}" maxLength={10} required placeholder="Enter the SMS code" value={code} onChange={e=>setCode(e.target.value)} disabled={busy}/></label>}
     {error&&<p role="alert" className="ci-guest-error">{error}</p>}
     {notice&&<p role="status" className="ci-guest-notice">{notice}</p>}
     <button type="submit" disabled={busy||!hotelId}>{busy?'Processing…':step==='code'?'Verify & sign in':'Text me a verification code'}</button>
     {step==='code'&&<button type="button" className="ci-guest-secondary" disabled={busy} onClick={()=>{setStep('phone');setCode('');setError('')}}>Change phone or hotel</button>}
    </form>
    <p className="ci-guest-disclaimer">Real SMS verification is required; there are no demo codes. Service activation depends on the hotel's configured authentication provider. A phone number alone does not authorize access to another guest's Lumen records.</p>
   </section>}
   <p className="ci-guest-footer">Need help? <Link href="/contact">Contact guest services</Link>. <Link href="/">Back to Crystal Inn</Link>.</p>
  </div>
 </main>;
}
