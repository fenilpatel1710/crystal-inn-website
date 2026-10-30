'use client';
import {useEffect,useState,FormEvent} from 'react';
import '../home-redesign.css';
type Hotel={id:string;display_name:string;city:string;region:string};
export default function Contact(){
 const [hotels,setHotels]=useState<Hotel[]>([]),[hotelId,setHotelId]=useState(''),[name,setName]=useState(''),[email,setEmail]=useState(''),
 [phone,setPhone]=useState(''),[subject,setSubject]=useState(''),[message,setMessage]=useState(''),[website,setWebsite]=useState(''),
 [busy,setBusy]=useState(false),[error,setError]=useState(''),[receipt,setReceipt]=useState(''),[pending,setPending]=useState(false);
 useEffect(()=>{const requested=new URLSearchParams(window.location.search).get('hotel')||'';fetch('/api/public/hotels').then(r=>r.json()).then(d=>{const list=Array.isArray(d.hotels)?d.hotels:[];setHotels(list);if(list.some((h:Hotel)=>h.id===requested))setHotelId(requested)}).catch(()=>{})},[]);
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');
 try{const r=await fetch('/api/public/inquiries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({hotelId,name,email,phone,subject,message,website})});
 const d=await r.json();if(!r.ok)throw Error(d.error||'Unable to submit.');
 setReceipt(d.id);setPending(d.notification!=='sent');setMessage('');setSubject('');
 }catch(err){setError(err instanceof Error?err.message:'Could not submit inquiry')}finally{setBusy(false)}
 }
 return <main className="ci-site" style={{minHeight:'100vh'}}><header className="ci-header"><div className="ci-shell ci-navbar"><a className="ci-brand" href="/"><img src="/crystal-inn-logo.svg" width="50" height="50" alt="Crystal Inn"/><span>CRYSTAL INN<small>HOTELS & STAYS</small></span></a><a className="ci-nav-cta" href="/request-stay">Request a stay</a></div></header>
 <section className="ci-shell ci-inner" style={{maxWidth:780,paddingTop:60,paddingBottom:100}}><p className="ci-eyebrow">GUEST SERVICES</p><h1>Contact Crystal Inn</h1><p>Send a message to the central Crystal Inn team or choose the location you are contacting. For reservations, select Request a Stay instead.</p>
 {receipt?<div role="status" style={{padding:20,background:'#eaf4ff',borderRadius:8}}><h2>Your inquiry has been received.</h2><p>Reference: {receipt}</p>{pending&&<p>Your message is saved, but email notification is not confirmed. For urgent inquiries, contact your selected hotel directly.</p>}<a href="/">Return to homepage</a></div>:<form onSubmit={submit} style={{display:'grid',gap:16,maxWidth:650}}>
 <label>Hotel (optional)<select value={hotelId} onChange={e=>setHotelId(e.target.value)}><option value="">General inquiry — Crystal Inn network</option>{hotels.map(h=><option key={h.id} value={h.id}>{h.display_name} — {h.city}, {h.region}</option>)}</select></label>
 <label>Your name<input required maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label>
 <label>Email address<input type="email" required maxLength={190} value={email} onChange={e=>setEmail(e.target.value)}/></label>
 <label>Phone (optional)<input type="tel" maxLength={35} value={phone} onChange={e=>setPhone(e.target.value)}/></label>
 <label>Subject<input required minLength={3} maxLength={150} value={subject} onChange={e=>setSubject(e.target.value)}/></label>
 <label>Message<textarea required minLength={10} maxLength={2500} rows={7} value={message} onChange={e=>setMessage(e.target.value)} style={{padding:12,border:'1px solid #c7d4e0',borderRadius:5}}/></label>
 <div style={{position:'absolute',left:-9999}} aria-hidden="true"><label>Website<input tabIndex={-1} value={website} onChange={e=>setWebsite(e.target.value)}/></label></div>
 <button type="submit" disabled={busy} className="ci-btn ci-btn-blue">{busy?'Sending...':'Submit inquiry'}</button>
 {error&&<p role="alert" style={{color:'#ad3030'}}>{error}</p>}
 </form>}</section></main>
}