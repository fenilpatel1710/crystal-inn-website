'use client';
import {FormEvent, useState, useEffect, useRef} from 'react';
import styles from './book.module.css';

type GuestSession={
 authenticated:boolean;hotelId?:string;hotelName?:string;phone?:string;
 profile?:{firstName:string;lastName:string;email:string}|null;
 profileSetupPending?:boolean;
};
type BookingForm={
  checkIn:string;checkOut:string;roomType:string;rooms:string;guests:string;
  firstName:string;lastName:string;phone:string;email:string;notes:string;website:string;
};
const blank:BookingForm={checkIn:'',checkOut:'',roomType:'King Non-Smoking',rooms:'1',guests:'2',firstName:'',lastName:'',phone:'',email:'',notes:'',website:''};
const tomorrow=()=>{const d=new Date();d.setDate(d.getDate()+1);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
export default function BookPage(){
 const [form,setForm]=useState<BookingForm>(blank);
 const [guestSession,setGuestSession]=useState<GuestSession|null>(null);
 useEffect(()=>{
  let mounted=true;
  fetch('/api/guest/me',{cache:'no-store'}).then(r=>r.json()).then((session:GuestSession)=>{
   if(!mounted||!session.authenticated||session.hotelId!=='crystal-inn-northwest-290')return;
   setGuestSession(session);
   setForm(prev=>({
    ...prev,
    phone:prev.phone||session.phone||'',
    firstName:prev.firstName||session.profile?.firstName||'',
    lastName:prev.lastName||session.profile?.lastName||'',
    email:prev.email||session.profile?.email||''
   }));
  }).catch(()=>{});
  return ()=>{mounted=false};
 },[]);
 useEffect(()=>{const params=new URLSearchParams(window.location.search);const allowed=new Set(['King Non-Smoking','King Smoking','Queen Non-Smoking','No preference']);setForm(prev=>({...prev,checkIn:/^\d{4}-\d{2}-\d{2}$/.test(params.get('checkIn')||'')?params.get('checkIn')!:prev.checkIn,checkOut:/^\d{4}-\d{2}-\d{2}$/.test(params.get('checkOut')||'')?params.get('checkOut')!:prev.checkOut,roomType:allowed.has(params.get('roomType')||'')?params.get('roomType')!:prev.roomType,guests:/^[1-8]$/.test(params.get('guests')||'')?params.get('guests')!:prev.guests}));},[]);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const [reference,setReference]=useState('');
 const [notificationPending,setNotificationPending]=useState(false);
 const requestKey=useRef<string>('');
 const change=(key:keyof BookingForm,value:string)=>setForm(p=>({...p,[key]:value}));
 async function submit(e:FormEvent<HTMLFormElement>){
   e.preventDefault();setError('');
   if(!form.checkIn||!form.checkOut||form.checkOut<=form.checkIn){setError('Select a check-out date after your check-in date.');return;}
   setLoading(true);
   if(!requestKey.current)requestKey.current=crypto.randomUUID();
   try{
     const response=await fetch('/api/reservations',{method:'POST',headers:{'Content-Type':'application/json','X-Reservation-Request-Key':requestKey.current},body:JSON.stringify(form),cache:'no-store'});
     const data=await response.json().catch(()=>({}));
     if(!response.ok)throw new Error(typeof data.error==='string'?data.error:'Unable to submit request. Please contact the front desk.');
     setReference(data.reference);setNotificationPending(data.notification!=='sent');requestKey.current='';setForm(blank);
   }catch(err){setError(err instanceof Error?err.message:'Unable to submit request.');}
   finally{setLoading(false);}
 }
 return <main className={styles.page}>
   <header className={styles.header}><a href="/" className={styles.brand}><img src="/crystal-inn-logo.svg" alt="" width="40" height="40"/><span>CRYSTAL INN <small>NORTHWEST 290 · HOUSTON</small></span></a><a href="/" className={styles.back}>← Back to website</a></header>
   <div className={styles.wrap}>
     <section className={styles.intro}><p className={styles.kicker}>RESERVATIONS</p><h1>Request your stay.</h1><p>Tell us when you would like to visit. Our front desk will check availability and contact you to confirm your room and rate.</p><div className={styles.warning}><strong>Request only — not a confirmed reservation.</strong> No room is held, no payment is collected, and availability is not guaranteed until the hotel contacts you.</div></section>
     {reference?<section className={styles.card} role="status"><div className={styles.success}>✓</div><h2>Request received</h2><p>Your request reference is <strong>{reference}</strong>.</p><p>The front desk must still confirm availability and pricing. Please do not consider your stay booked until the hotel confirms it.</p>{notificationPending&&<p className={styles.warning}><strong>Your request is saved, but front-desk email delivery is not confirmed.</strong> Please call <a href="tel:+17139936567">713-993-6567</a> and provide your reference number.</p>}<button className={styles.button} onClick={()=>setReference('')}>Send another request</button><a className={styles.link} href="/">Return to Crystal Inn</a></section>:
     <form className={styles.card} onSubmit={submit}>
       <h2>Stay details</h2>
       <div className={styles.grid}>
         <label>Check-in date<input required type="date" min={tomorrow()} value={form.checkIn} onChange={e=>change('checkIn',e.target.value)}/></label>
         <label>Check-out date<input required type="date" min={form.checkIn||tomorrow()} value={form.checkOut} onChange={e=>change('checkOut',e.target.value)}/></label>
         <label>Preferred room type<select value={form.roomType} onChange={e=>change('roomType',e.target.value)}><option>King Non-Smoking</option><option>King Smoking</option><option>Queen Non-Smoking</option><option>No preference</option></select></label>
         <label>Number of rooms<select value={form.rooms} onChange={e=>change('rooms',e.target.value)}>{[1,2,3,4].map(n=><option key={n}>{n}</option>)}</select></label>
         <label>Guests<select value={form.guests} onChange={e=>change('guests',e.target.value)}>{[1,2,3,4,5,6,7,8].map(n=><option key={n}>{n}</option>)}</select></label>
       </div>
       <h2>Guest contact</h2>
       {guestSession?.authenticated&&<p className={styles.guestNotice}>
        Signed in to <strong>{guestSession.hotelName}</strong>.
        {guestSession.profile?' Your saved guest details have been filled in.':' Complete your guest details with this request.'}
        {' '}This reservation request will be linked to your verified phone account.
       </p>}
       {!guestSession&&<p className={styles.guestNotice}>
        New guest? Enter your contact details below to request a stay.
        {' '}<a href="/guest/login?hotel=northwest-290">Sign in by SMS</a> first if you want your details saved for future reservations.
       </p>}
       <div className={styles.grid}>
         <label>First name<input required maxLength={70} autoComplete="given-name" value={form.firstName} onChange={e=>change('firstName',e.target.value)}/></label>
         <label>Last name<input required maxLength={70} autoComplete="family-name" value={form.lastName} onChange={e=>change('lastName',e.target.value)}/></label>
         <label>Phone number<input required type="tel" maxLength={30} autoComplete="tel" value={form.phone} disabled={Boolean(guestSession)} onChange={e=>change('phone',e.target.value)} placeholder="(713) 555-0123"/></label>
         <label>Email address<input required type="email" maxLength={160} autoComplete="email" value={form.email} onChange={e=>change('email',e.target.value)} placeholder="guest@example.com"/></label>
       </div>
       <label>Special requests (optional)<textarea rows={3} maxLength={600} value={form.notes} onChange={e=>change('notes',e.target.value)} placeholder="Accessibility requests, expected arrival time, etc."/></label>
       <div aria-hidden="true" className={styles.honeypot}><label>Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={e=>change('website',e.target.value)}/></label></div>
       <p className={styles.disclaimer}>By submitting, you consent to being contacted about this stay request by phone or email. The front desk will verify and scan your government-issued photo ID at check-in according to hotel policy; no ID image or ID number is collected by this website. Please do not enter payment card numbers or ID details here.</p>
       {error&&<p className={styles.error} role="alert">{error}</p>}
       <button className={styles.button} disabled={loading} type="submit">{loading?'Saving request…':'Send reservation request'}</button>
       <p className={styles.fine}>Need immediate assistance? Call the hotel directly at <a href="tel:+17139936567">713-993-6567</a>.</p>
     </form>}
   </div>
 </main>
}
