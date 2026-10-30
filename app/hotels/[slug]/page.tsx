'use client';
import {useEffect,useState} from 'react';
import {useParams} from 'next/navigation';
import '../../home-redesign.css';
type Hotel={id:string;slug:string;display_name:string;city:string;region:string;address_text?:string;description?:string;public_phone?:string;public_email?:string;hero_image_url?:string|null;is_legacy_booking?:boolean};
type Room={id:string;display_name:string;description:string;image_url?:string|null};
const exterior='https://www.dayuse.com/_next/image?q=75&url=https%3A%2F%2Fstatic.dayuse.com%2Fhotels%2F20739%2F499669dc8ce8206527d489d9ef890f2d-crystal-inn-northwest-290.jpg&w=3840';
export default function HotelPage(){
 const params=useParams();const slug=typeof params.slug==='string'?params.slug:'';
 const [hotel,setHotel]=useState<Hotel|null>(null),[rooms,setRooms]=useState<Room[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{if(!slug)return;setLoading(true);fetch('/api/public/hotels/'+encodeURIComponent(slug)).then(async r=>{const d=await r.json();if(!r.ok)throw Error('This hotel is not available.');setHotel(d.hotel);setRooms(d.rooms||[])}).catch(e=>setError(e.message)).finally(()=>setLoading(false))},[slug]);
 return <main className="ci-site"><header className="ci-header"><div className="ci-shell ci-navbar"><a href="/" className="ci-brand"><img src="/crystal-inn-logo.svg" width="50" height="50" alt="Crystal Inn"/><span>CRYSTAL INN<small>HOTELS & STAYS</small></span></a><a href="/#find-hotels" className="ci-nav-cta">All locations</a></div></header>
 {loading?<div className="ci-shell ci-inner"><p>Loading hotel information…</p></div>:error?<div className="ci-shell ci-inner"><h1>Hotel not found</h1><p>{error}</p><a href="/#find-hotels">Find another hotel</a></div>:hotel&&<>
 <section className="ci-property-hero" style={{backgroundImage:`linear-gradient(90deg,rgba(9,28,53,.9),rgba(9,28,53,.25)),url("${hotel.hero_image_url||(hotel.slug==='northwest-290'?exterior:'')}")`}}><div className="ci-shell"><span className="ci-eyebrow ci-on-dark">{hotel.city}, {hotel.region}</span><h1>{hotel.display_name}</h1><p>{hotel.description||'Enjoy a comfortable stay with Crystal Inn.'}</p><div className="ci-hero-actions">{hotel.is_legacy_booking?<a href="/book" className="ci-btn ci-btn-white">Request a stay →</a>:<a href={'/contact?hotel='+encodeURIComponent(hotel.id)} className="ci-btn ci-btn-white">Send an inquiry →</a>}<a className="ci-btn ci-btn-outline" href="/#find-hotels">Other locations</a></div></div></section>
 <section className="ci-shell ci-inner"><p className="ci-eyebrow">YOUR HOTEL</p><h2>Rooms & accommodations</h2>{rooms.length?<div className="ci-property-rooms">{rooms.map(r=><article key={r.id}>{r.image_url&&<img src={r.image_url} alt={r.display_name} style={{width:'100%',height:180,objectFit:'cover',marginBottom:17}} loading="lazy"/>}<h3>{r.display_name}</h3><p>{r.description||'Room details available from the property.'}</p></article>)}</div>:<p>Room descriptions and availability are available from the property's front desk.</p>}
 <section className="ci-property-contact" id="contact"><p><a href={'/contact?hotel='+encodeURIComponent(hotel.id)}>Send an inquiry about this hotel →</a></p><h2>Contact {hotel.display_name}</h2><p>{hotel.address_text||hotel.city+', '+hotel.region}</p>{hotel.public_phone&&<p>Phone: <a href={'tel:'+hotel.public_phone.replace(/[^+\d]/g,'')}>{hotel.public_phone}</a></p>}{hotel.public_email&&<p>Email: <a href={'mailto:'+hotel.public_email}>{hotel.public_email}</a></p>}{!hotel.is_legacy_booking&&<p>Online booking for this property will become available after its room inventory and independent PMS setup have been verified.</p>}</section></section>
 </>}
 </main>
}
