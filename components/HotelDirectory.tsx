'use client';
import {useEffect,useState} from 'react';
type Hotel={id:string;slug:string;display_name:string;city:string;region:string;description:string;hero_image_url:string|null;public_phone?:string;is_legacy_booking?:boolean};
const exterior='https://www.dayuse.com/_next/image?q=75&url=https%3A%2F%2Fstatic.dayuse.com%2Fhotels%2F20739%2F499669dc8ce8206527d489d9ef890f2d-crystal-inn-northwest-290.jpg&w=3840';
export default function HotelDirectory({compact=false}:{compact?:boolean}){
 const [hotels,setHotels]=useState<Hotel[]>([]),[query,setQuery]=useState('');
 useEffect(()=>{fetch('/api/public/hotels').then(r=>r.json()).then(d=>setHotels(Array.isArray(d.hotels)?d.hotels:[])).catch(()=>{})},[]);
 const shown=hotels.filter(h=>(h.display_name+' '+h.city+' '+h.region).toLowerCase().includes(query.trim().toLowerCase()));
 return <section className={compact?'ci-hotels ci-hotels-compact':'ci-hotels'} id="find-hotels"><div className="ci-shell">
 <div className="ci-section-label"><span>01</span> OUR LOCATIONS <span className="ci-section-rule"/></div>
 <div className="ci-section-head"><div><p className="ci-eyebrow">EXPLORE CRYSTAL INN</p><h2>Find your Crystal Inn.</h2></div><p>Each location has its own rooms, team, rates and guest experience. Choose the hotel that suits your plans.</p></div>
 <label className="ci-hotel-search"><span>SEARCH BY CITY OR HOTEL</span><input type="search" placeholder="Search Crystal Inn locations..." value={query} onChange={e=>setQuery(e.target.value)}/></label>
 <div className="ci-hotel-list">{shown.map(h=><article className="ci-hotel-card" key={h.id}>
 <div className="ci-hotel-card-image">{h.hero_image_url?<img src={h.hero_image_url} alt={h.display_name}/>:h.slug==='northwest-290'?<img src={exterior} alt="Crystal Inn Northwest 290 hotel exterior"/>:<div className="ci-hotel-placeholder"><span>CRYSTAL INN</span></div>}</div>
 <div className="ci-hotel-card-content"><span className="ci-hotel-location">{h.city}, {h.region}</span><h3>{h.display_name}</h3><p>{h.description||'Discover rooms, amenities and local hospitality at this Crystal Inn location.'}</p>
 <div className="ci-hotel-card-actions"><a href={'/hotels/'+encodeURIComponent(h.slug)}>Explore hotel →</a>{h.is_legacy_booking&&<a href="/book" className="ci-hotel-request">Request a stay</a>}</div></div></article>)}</div>
 {!shown.length&&<p className="ci-hotel-empty">No hotels match your search.</p>}
 </div></section>
}
