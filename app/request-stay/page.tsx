'use client';
import {useEffect,useState} from 'react';
import '../home-redesign.css';
type Hotel={id:string;slug:string;display_name:string;city:string;region:string;is_legacy_booking:boolean;public_phone:string|null};
export default function RequestStay(){
 const [hotels,setHotels]=useState<Hotel[]>([]),[hotel,setHotel]=useState(''),[loading,setLoading]=useState(true);
 const [checkIn,setCheckIn]=useState(''),[checkOut,setCheckOut]=useState(''),[guests,setGuests]=useState('2');
 useEffect(()=>{fetch('/api/public/hotels').then(r=>r.json()).then(d=>{setHotels(Array.isArray(d.hotels)?d.hotels:[])}).catch(()=>{}).finally(()=>setLoading(false))},[]);
 const chosen=hotels.find(h=>h.slug===hotel);
 function next(e:React.FormEvent){e.preventDefault();if(!chosen||checkOut<=checkIn)return;
 if(chosen.is_legacy_booking){const q=new URLSearchParams({checkIn,checkOut,guests});window.location.href='/book?'+q.toString()}
 else window.location.href='/hotels/'+encodeURIComponent(chosen.slug);
 }
 return <main className="ci-site"><header className="ci-header"><div className="ci-shell ci-navbar"><a href="/" className="ci-brand"><img src="/crystal-inn-logo.svg" alt="Crystal Inn" width="50" height="50"/><span>CRYSTAL INN<small>HOTELS & STAYS</small></span></a><a href="/" className="ci-nav-cta">Back to homepage</a></div></header>
 <section className="ci-shell ci-inner ci-choose-hotel"><p className="ci-eyebrow">REQUEST A STAY</p><h1>Where would you like to stay?</h1><p className="ci-inner-sub">Select your Crystal Inn location first. Every hotel has its own rooms, rates and reservation team.</p>
 <form onSubmit={next} className="ci-select-form"><label>YOUR HOTEL<select required value={hotel} onChange={e=>setHotel(e.target.value)} disabled={loading}><option value="">{loading?'Loading hotels...':'Select a Crystal Inn location'}</option>{hotels.map(h=><option key={h.id} value={h.slug}>{h.display_name} — {h.city}, {h.region}</option>)}</select></label>
 {chosen&&<><div className="ci-selected-property"><strong>{chosen.display_name}</strong><p>{chosen.city}, {chosen.region}</p>{!chosen.is_legacy_booking&&<p>Online reservation requests are not enabled for this property yet. You can view its hotel page and contact information.</p>}</div><div className="ci-date-fields"><label>CHECK-IN<input type="date" required value={checkIn} onChange={e=>setCheckIn(e.target.value)}/></label><label>CHECK-OUT<input type="date" required min={checkIn} value={checkOut} onChange={e=>setCheckOut(e.target.value)}/></label><label>GUESTS<select value={guests} onChange={e=>setGuests(e.target.value)}>{[1,2,3,4,5,6,7,8].map(x=><option key={x} value={x}>{x}</option>)}</select></label></div></>}
 <button className="ci-btn ci-btn-blue" type="submit" disabled={!chosen||!checkIn||!checkOut||checkOut<=checkIn}>{chosen?.is_legacy_booking?'Continue reservation request':'View hotel details'} →</button>
 </form><p className="ci-footnote">Reservations are only requests until the selected hotel's team confirms availability and rate.</p>
 </section></main>
}