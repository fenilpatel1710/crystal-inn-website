'use client';
import {useEffect,useState} from 'react';
import {useParams} from 'next/navigation';
import '../../home-redesign.css';

type Hotel={
 id:string;slug:string;display_name:string;city:string;region:string;address_text?:string|null;
 description?:string|null;public_phone?:string|null;public_email?:string|null;hero_image_url?:string|null;
 is_legacy_booking?:boolean;rewards_enabled?:number;
};
type Room={id:string;display_name:string;description:string|null;image_url?:string|null};
function ImageWithFallback({src,alt,className}:{src:string|null|undefined;alt:string;className?:string}){
 const [broken,setBroken]=useState(false);
 useEffect(()=>setBroken(false),[src]);
 return src&&!broken?<img className={className} src={src} alt={alt} onError={()=>setBroken(true)} loading="lazy"/>:<div className={'ci-property-image-placeholder '+(className||'')} role="img" aria-label={alt+' — photo not yet available'}><span>CRYSTAL INN</span><small>Photo coming soon</small></div>;
}
export default function HotelPage(){
 const params=useParams(),slug=typeof params.slug==='string'?params.slug:'';
 const [hotel,setHotel]=useState<Hotel|null>(null),[rooms,setRooms]=useState<Room[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [checkIn,setCheckIn]=useState(''),[checkOut,setCheckOut]=useState(''),[guests,setGuests]=useState('2');
 const [photo,setPhoto]=useState<{url:string;alt:string}|null>(null);
 useEffect(()=>{
  if(!slug)return;
  let active=true;setLoading(true);setError('');setHotel(null);setRooms([]);
  fetch('/api/public/hotels/'+encodeURIComponent(slug),{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'This property is not available.');if(active){setHotel(d.hotel);setRooms(Array.isArray(d.rooms)?d.rooms:[])}})
  .catch(e=>{if(active)setError(e instanceof Error?e.message:'Unable to load this property.')})
  .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[slug]);
 useEffect(()=>{if(!photo)return;const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setPhoto(null)};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close)},[photo]);
 const requestUrl=hotel?'/request-stay?'+new URLSearchParams({hotel:hotel.slug,...(checkIn?{checkIn}:{}),...(checkOut?{checkOut}:{}),guests}).toString():'/request-stay';
 const guestInquiryUrl=hotel?'/contact?hotel='+encodeURIComponent(hotel.id):'/contact';
 const address=hotel?.address_text?.trim()||'';
 const mapQuery=address||[hotel?.display_name,hotel?.city,hotel?.region].filter(Boolean).join(', ');
 const directionsUrl='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(mapQuery);
 const today=new Date().toLocaleDateString('en-CA');
 return <main className="ci-site ci-property-page">
 <div className="ci-property-utility"><div className="ci-shell"><span>CRYSTAL INN HOTELS & STAYS</span><a href="/#find-hotels">Explore all locations ↗</a></div></div>
 <header className="ci-header"><div className="ci-shell ci-navbar"><a href="/" className="ci-brand"><img src="/crystal-inn-logo.svg" width="50" height="50" alt="Crystal Inn logo"/><span>CRYSTAL INN<small>HOTELS & STAYS</small></span></a><nav className="ci-property-topnav"><a href="/#find-hotels">Our hotels</a><a href="#accommodations">Rooms</a><a href="#location">Location</a><a className="ci-property-nav-cta" href={guestInquiryUrl}>Contact hotel ↗</a></nav></div></header>
 {loading?<div className="ci-shell ci-property-loading"><h1>Discover your Crystal Inn</h1><p>Loading property information…</p></div>:error||!hotel?<div className="ci-shell ci-property-loading"><p className="ci-eyebrow">PROPERTY UNAVAILABLE</p><h1>We couldn’t find this hotel.</h1><p>{error||'Please return to the hotel directory.'}</p><a className="ci-btn ci-btn-blue" href="/#find-hotels">Browse Crystal Inn locations →</a></div>:<>
 <div className="ci-shell ci-property-breadcrumb"><a href="/">Home</a><span>/</span><a href="/#find-hotels">Locations</a><span>/</span><strong>{hotel.display_name}</strong></div>
 <section className="ci-property-intro">
  <div className="ci-shell ci-property-intro-layout">
   <div className="ci-property-intro-copy"><p className="ci-eyebrow">YOUR STAY STARTS HERE · {hotel.city.toUpperCase()}, {hotel.region.toUpperCase()}</p><h1>{hotel.display_name}</h1><p className="ci-property-lead">{hotel.description?.trim()||'A welcoming place to stay in '+hotel.city+'. Discover the property, browse available room categories and contact the team to plan your visit.'}</p>
   <div className="ci-property-action-row"><a className="ci-btn ci-btn-blue" href="#plan-stay">Plan your stay <span aria-hidden="true">→</span></a><a className="ci-property-outline-link" href="#accommodations">Explore rooms ↗</a></div>
   <div className="ci-property-intro-facts"><span>◈ {hotel.city}, {hotel.region}</span><span>◈ Contact the hotel for current rates</span></div>
   </div>
   <div className="ci-property-photo-main">
    <ImageWithFallback src={hotel.hero_image_url} alt={hotel.display_name+' exterior and entrance'}/>
    {hotel.hero_image_url&&<button type="button" className="ci-property-photo-expand" onClick={()=>setPhoto({url:hotel.hero_image_url!,alt:hotel.display_name+' exterior'})}>View photo ↗</button>}
    <span className="ci-property-photo-label">WELCOME TO {hotel.display_name.toUpperCase()}</span>
   </div>
  </div>
 </section>
 <section className="ci-property-quickbar" aria-label="Property page sections"><div className="ci-shell"><a href="#overview">Overview</a><a href="#accommodations">Rooms</a><a href="#plan-stay">Plan a stay</a><a href="#location">Location & contact</a></div></section>
 <section className="ci-property-section" id="overview"><div className="ci-shell ci-property-about">
 <div><p className="ci-eyebrow">01 / GET TO KNOW YOUR HOTEL</p><h2>Make yourself<br/><em>at home.</em></h2></div>
 <div><p>{hotel.description?.trim()||'Explore the accommodations and contact details for '+hotel.display_name+'. Our hotel team can help you understand available room options and plan your visit.'}</p><p className="ci-property-muted">Room amenities, rates and availability can vary. Please contact this property to confirm details before your stay.</p><a href="#location" className="ci-property-text-link">Contact this property →</a></div>
 </div></section>
 <section className="ci-property-section ci-property-rooms-section" id="accommodations"><div className="ci-shell">
 <div className="ci-property-section-heading"><div><p className="ci-eyebrow">02 / ACCOMMODATIONS</p><h2>Find your kind<br/>of comfort.</h2></div><p>Explore the room categories currently listed for this property. Photos and descriptions are maintained by the hotel team.</p></div>
 {rooms.length?<div className="ci-property-room-grid">{rooms.map(room=><article className="ci-property-room-card" key={room.id}>
  <div className="ci-property-room-image"><ImageWithFallback src={room.image_url} alt={room.display_name+' room'}/>{room.image_url&&<button type="button" onClick={()=>setPhoto({url:room.image_url!,alt:room.display_name})}>View photo ↗</button>}</div>
  <div className="ci-property-room-info"><span className="ci-property-card-kicker">ROOM TYPE</span><h3>{room.display_name}</h3><p>{room.description?.trim()||'Contact the property for room details, amenities and availability.'}</p><a href={requestUrl}>Request this hotel →</a></div>
 </article>)}</div>:<div className="ci-property-no-rooms"><div><span className="ci-property-card-kicker">ROOMS & ACCOMMODATIONS</span><h3>Let's find the right room for you.</h3><p>Online room details are being prepared for this property. You can still contact the hotel to ask about room types, rates and availability.</p><a href={guestInquiryUrl} className="ci-btn ci-btn-blue">Ask about rooms →</a></div></div>}
 </div></section>
 <section className="ci-property-section ci-property-booking-section" id="plan-stay"><div className="ci-shell ci-property-booking-grid"><div><p className="ci-eyebrow">03 / PLAN YOUR VISIT</p><h2>Your next stay,<br/><em>made simple.</em></h2><p>Choose your dates and number of guests. We'll carry your selections into the stay-request flow for this hotel.</p><p className="ci-property-muted">Submitting a request does not confirm a reservation, room rate or availability. Your hotel team will need to confirm these details.</p></div><div className="ci-property-booking-card"><p className="ci-property-card-kicker">REQUEST A STAY</p><h3>{hotel.display_name}</h3><div className="ci-property-booking-fields"><label>CHECK-IN<input type="date" min={today} value={checkIn} onChange={e=>{setCheckIn(e.target.value);if(checkOut&&e.target.value>=checkOut)setCheckOut('')}}/></label><label>CHECK-OUT<input type="date" min={checkIn||today} value={checkOut} onChange={e=>setCheckOut(e.target.value)}/></label><label>GUESTS<select value={guests} onChange={e=>setGuests(e.target.value)}>{Array.from({length:8},(_,i)=>i+1).map(n=><option value={n} key={n}>{n} {n===1?'guest':'guests'}</option>)}</select></label></div><a className="ci-btn ci-btn-blue ci-property-booking-submit" href={requestUrl}>Continue to stay request →</a><p>Not a confirmed reservation · No payment collected</p></div></div></section>
 <section className="ci-property-section ci-property-location-section" id="location"><div className="ci-shell"><div className="ci-property-section-heading"><div><p className="ci-eyebrow">04 / LOCATION & CONTACT</p><h2>We're here<br/>to help.</h2></div><p>Questions about your stay? Contact the selected hotel or send a message to Crystal Inn guest services.</p></div><div className="ci-property-contact-cards"><article><span className="ci-property-card-kicker">FIND US</span><h3>{hotel.city}, {hotel.region}</h3><p>{address||'Contact the hotel for its complete street address.'}</p><a href={directionsUrl} target="_blank" rel="noopener noreferrer">View location on Google Maps ↗</a></article><article><span className="ci-property-card-kicker">GET IN TOUCH</span><h3>Property assistance</h3>{hotel.public_phone?<p><a href={'tel:'+hotel.public_phone.replace(/[^+\d]/g,'')}>{hotel.public_phone}</a></p>:<p>Phone number available through guest services.</p>}{hotel.public_email&&<p><a href={'mailto:'+hotel.public_email}>{hotel.public_email}</a></p>}<a href={guestInquiryUrl}>Send a hotel inquiry ↗</a></article></div></div></section>
 <section className="ci-property-bottom-cta"><div className="ci-shell"><div><p className="ci-eyebrow ci-on-dark">CRYSTAL INN HOTELS</p><h2>Ready to explore<br/>your stay?</h2><p>Connect with the hotel team and discover what's available.</p></div><a className="ci-btn ci-btn-white" href={requestUrl}>Request a stay →</a></div></section>
 {photo&&<div className="ci-property-lightbox" role="dialog" aria-modal="true" aria-label="Property photo preview" onClick={()=>setPhoto(null)}><button type="button" className="ci-property-lightbox-close" aria-label="Close photo" onClick={()=>setPhoto(null)}>×</button><img src={photo.url} alt={photo.alt} onClick={e=>e.stopPropagation()}/></div>}
 </>}
 </main>;
}
