'use client';
import {useState,FormEvent,useEffect} from 'react';
import './home-redesign.css';
import './hospitality-premium.css';
import HotelDirectory from '../components/HotelDirectory';

type Page='home'|'rooms'|'rewards'|'reviews'|'account';
type IconName='calendar'|'bed'|'coffee'|'wifi'|'car'|'map'|'gift'|'arrow'|'clock'|'shield'|'phone'|'check'|'user'|'star'|'spark'|'shower'|'credit';
const shapes:Record<IconName,React.ReactNode>={
 calendar:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></>,
 bed:<><path d="M3 18V8m18 10V8M3 14h18M5 14V9a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v5M3 18v3m18-3v3M7 11h4m2 0h4"/></>,
 coffee:<><path d="M4 8h13v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8ZM17 9h2a3 3 0 0 1 0 6h-2M8 3v2m5-2v2"/></>,
 wifi:<><path d="M2 9a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M9 16a4 4 0 0 1 6 0"/><circle cx="12" cy="20" r="1" fill="currentColor" stroke="none"/></>,
 car:<><path d="M5 11 7 5h10l2 6M3 11h18v8H3zM5 19v2m14-2v2M7 15h2m6 0h2"/></>,
 map:<><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.6"/></>,
 gift:<><rect x="3" y="9" width="18" height="12" rx="1"/><path d="M2 9h20M12 9v12M12 9c-8 0-9-7-5-7 3 0 5 5 5 7Zm0 0c8 0 9-7 5-7-3 0-5 5-5 7Z"/></>,
 arrow:<><path d="M5 12h14M13 6l6 6-6 6"/></>,
 clock:<><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></>,
 shield:<><path d="M12 2 4 6v6c0 5 4 8 8 10 4-2 8-5 8-10V6z"/><path d="m8 12 3 3 5-6"/></>,
 phone:<><path d="M6 3h4l1 5-3 2a16 16 0 0 0 6 6l2-3 5 1v4c0 2-2 3-4 3C8 21 3 10 3 6c0-2 1-3 3-3Z"/></>,
 check:<><path d="m5 12 5 5L20 7"/></>,
 user:<><circle cx="12" cy="8" r="4"/><path d="M4 22v-2a8 8 0 0 1 16 0v2"/></>,
 star:<><path d="m12 2 3 6 7 .9-5 4.8 1.3 7-6.3-3.4-6.3 3.4 1.3-7L2 8.9 9 8z"/></>,
 spark:<><path d="m12 2 2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2Z"/></>,
 shower:<><path d="M4 21V8a5 5 0 0 1 10 0v2M9 10h10M9 14h10M11 18v2m6-2v2"/></>,
 credit:<><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h5"/></>
};
function Icon({name,size=22}:{name:IconName,size?:number}){return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shapes[name]}</svg>}

const exterior='https://www.dayuse.com/_next/image?q=75&url=https%3A%2F%2Fstatic.dayuse.com%2Fhotels%2F20739%2F499669dc8ce8206527d489d9ef890f2d-crystal-inn-northwest-290.jpg&w=1200';
const king='https://cf.bstatic.com/xdata/images/hotel/max1024x768/791838179.jpg?k=8ff77c4d52ecb17a14b39fb001847f91c39f2e75440ccfc1f332b7897825b3bd&o=';
const queen='/crystal-double-bed.svg';
const rooms=[{title:'King Room',note:'A relaxing stay with room to unwind.',image:king,tag:'COMFORT',name:'King Non-Smoking'},{title:'Double Bed Room',note:'Two comfortable beds for family or shared stays.',image:queen,tag:'TWO BEDS',name:'No preference'},{title:'Kitchenette Options',note:'Added convenience in select accommodations.',image:king,tag:'SELECT ROOMS',name:'No preference'}];
const amenities:[IconName,string,string][]=[['coffee','Breakfast','Check availability at your selected hotel'],['wifi','Wi-Fi','See your hotel’s available connectivity'],['car','Parking','Check parking details for each location'],['clock','Front Desk','Contact your selected hotel for stay details'],['shower','Room Features','Explore amenities on each property page'],['gift','Guest Rewards','Available only at participating hotels']];
function RewardsCard(){return <div className="ci-loyalty-card"><div className="ci-member-top"><img src="/crystal-inn-logo.svg" width="40" height="40" alt=""/><span>CRYSTAL INN<small>GUEST REWARDS</small></span><Icon name="spark"/></div><div className="ci-member-mid">Stay. Earn. Return.</div><div className="ci-member-bottom"><span>MEMBERSHIP BENEFITS</span><Icon name="gift"/></div></div>}
export default function Home(){
 const [page,setPage]=useState<Page>('home');
 const [selectedHotel,setSelectedHotel]=useState('');
 const [featured,setFeatured]=useState<{id:string;slug:string;display_name:string;city:string;region:string;description:string|null;featured_image_url:string|null}[]>([]);
 const [heroPhotos,setHeroPhotos]=useState<{id:string;caption:string;url:string}[]>([]);
 const [heroIndex,setHeroIndex]=useState(0);
 const [hotelOptions,setHotelOptions]=useState<{id:string;slug:string;display_name:string;city:string;region:string;rewards_enabled?:number}[]>([]);
 const [mobile,setMobile]=useState(false);
 const [message,setMessage]=useState('');
 const [checkIn,setCheckIn]=useState('');const [checkOut,setCheckOut]=useState('');const [guests,setGuests]=useState('2');
 useEffect(()=>{fetch('/api/public/hotels').then(r=>r.json()).then(d=>{if(Array.isArray(d.hotels))setHotelOptions(d.hotels)}).catch(()=>{});fetch('/api/public/featured').then(r=>r.json()).then(d=>{if(Array.isArray(d.hotels))setFeatured(d.hotels)}).catch(()=>{})},[]);
 useEffect(()=>{
  let active=true;
  fetch('/api/public/homepage',{cache:'no-store'}).then(r=>r.json()).then(d=>{
   if(!active||!Array.isArray(d.photos))return;
   const photos=d.photos.filter((p:unknown):p is {id:string;caption:string;url:string}=>{
    if(!p||typeof p!=='object')return false;
    const item=p as Record<string,unknown>;
    return typeof item.id==='string'&&typeof item.caption==='string'&&typeof item.url==='string'&&
      /^\/api\/public\/homepage\/photo\?id=[0-9a-f-]{36}$/.test(item.url);
   });
   setHeroPhotos(photos);
   setHeroIndex(Math.max(0,photos.findIndex((p)=>p.id===d.activeId)));
  }).catch(()=>{});
  return()=>{active=false};
 },[]);
 const heroPhoto=heroPhotos[heroIndex];
 const change=(p:Page)=>{setPage(p);setMobile(false);setMessage('');window.scrollTo({top:0,behavior:'smooth'})};
 const submitStay=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();if(!checkIn||!checkOut||checkOut<=checkIn){setMessage('Choose a checkout date after your arrival date.');return;}const p=new URLSearchParams({checkIn,checkOut,guests});window.location.href='/request-stay?'+p.toString()};
const navItems:[Page,string][]=[['home','Home'],['rooms','Our Hotels'],['rewards','Rewards'],['reviews','Guest Reviews']];
 return <div className="ci-site">
  <div className="ci-utility"><div className="ci-shell"><span><Icon name="map" size={15}/> A place to stay in Houston</span><a href="/contact"><Icon name="phone" size={15}/> Get in touch</a></div></div>
  <header className="ci-header"><div className="ci-shell ci-navbar"><button className="ci-brand" onClick={()=>change('home')}><img src="/crystal-inn-logo.svg" alt="Crystal Inn logo" width="50" height="50"/><span>CRYSTAL INN<small>HOTELS & STAYS</small></span></button><button aria-expanded={mobile} aria-label="Toggle navigation" className="ci-mobile-menu" onClick={()=>setMobile(!mobile)}>☰</button><nav className={mobile?'ci-nav ci-nav-open':'ci-nav'} aria-label="Main navigation">{navItems.map(([p,label])=><button className={page===p?'ci-nav-active':''} key={p} onClick={()=>change(p)}>{label}</button>)}<a className="ci-nav-guest" href="/guest/login"><Icon name="user" size={17}/> Sign in</a><a className="ci-nav-cta" href="/request-stay">Plan your stay <Icon name="arrow" size={18}/></a></nav></div></header>
  {page==='home'&&<>
   <section className="ci-hero" aria-label="Welcome to Crystal Inn">
    <div className="ci-shell ci-hero-layout">
     <div className="ci-hero-copy">
      <p className="ci-hero-overline"><span aria-hidden="true" className="ci-hero-overline-rule"/> CRYSTAL INN · HOUSTON, TEXAS</p>
      <h1>Come in.<br/><em>Get comfortable.</em></h1>
      <p className="ci-hero-description">A familiar welcome, a comfortable room, and a place that feels easy to come back to. Find the Crystal Inn that fits your trip.</p>
      <div className="ci-hero-actions">
       <a className="ci-btn ci-btn-white ci-hero-primary" href="#find-hotels">Explore our hotels <Icon name="arrow" size={20}/></a>
       <a className="ci-hero-text-link" href="/request-stay">Plan a stay <Icon name="arrow" size={17}/></a>
      </div>
      <div className="ci-hero-facts" aria-label="What you can explore"><span><Icon name="bed" size={18}/> Room details</span><span><Icon name="map" size={18}/> Hotel locations</span><span><Icon name="phone" size={18}/> Direct contact</span></div>
     </div>
     <figure className="ci-hero-visual">
      <img key={heroPhoto?.id||'default'} src={heroPhoto?.url||exterior} alt={heroPhoto?.caption||'Exterior of Crystal Inn Northwest 290 in Houston'} fetchPriority="high" decoding="async"/>
      <figcaption className="ci-hero-image-caption"><span className="ci-hero-image-caption-index">{heroPhotos.length?String(heroIndex+1).padStart(2,'0')+' / '+String(heroPhotos.length).padStart(2,'0'):'01 / HOUSTON'}</span><span>{heroPhoto?.caption||'Crystal Inn Northwest 290'}</span></figcaption>
      <div className="ci-hero-seal" aria-hidden="true"><span>WELCOME TO</span><strong>HOUSTON</strong><span>YOUR STAY STARTS HERE</span></div>
      {heroPhotos.length>1&&<div className="ci-hero-photo-controls" aria-label="Homepage photo gallery">
       <button type="button" aria-label="Previous hotel photo" onClick={()=>setHeroIndex(i=>(i+heroPhotos.length-1)%heroPhotos.length)}><span aria-hidden="true">‹</span></button>
       <span aria-live="polite">{heroIndex+1} / {heroPhotos.length}</span>
       <button type="button" aria-label="Next hotel photo" onClick={()=>setHeroIndex(i=>(i+1)%heroPhotos.length)}><span aria-hidden="true">›</span></button>
      </div>}
     </figure>
    </div>
   </section>
   <div className="ci-shell ci-booking-wrap"><div className="ci-booking-topline"><span><Icon name="calendar" size={15}/> PLAN YOUR STAY</span><span>Dates first. The rest is easy.</span></div><form className="ci-booking-widget" onSubmit={submitStay}><div className="ci-booking-title"><span className="ci-icon-tile"><Icon name="calendar" size={23}/></span><div><strong>Let’s get you settled.</strong><small>Select dates to begin</small></div></div><label><span>CHECK-IN</span><input aria-label="Check-in date" type="date" required value={checkIn} onChange={e=>setCheckIn(e.target.value)}/></label><label><span>CHECK-OUT</span><input aria-label="Check-out date" type="date" required min={checkIn} value={checkOut} onChange={e=>setCheckOut(e.target.value)}/></label><label><span>GUESTS</span><select aria-label="Number of guests" value={guests} onChange={e=>setGuests(e.target.value)}>{[1,2,3,4,5,6,7,8].map(x=><option key={x} value={x}>{x} {x===1?'guest':'guests'}</option>)}</select></label><button className="ci-btn ci-btn-blue" type="submit">Continue <Icon name="arrow" size={18}/></button></form>{message&&<p className="ci-inline-notice" role="alert">{message}</p>}</div>
   <HotelDirectory/>
   <section className="ci-section ci-experience-section"><div className="ci-shell"><div className="ci-section-label"><span>02</span> THE GOOD STUFF <span className="ci-section-rule"/></div><div className="ci-section-head"><div><p className="ci-eyebrow">EVERYDAY COMFORT</p><h2>Settle in. Stay a while.</h2></div><p>A comfortable room, the everyday essentials, and a welcoming place to come back to. See each hotel for its amenities.</p></div><div className="ci-amenities">{amenities.map(([ico,title,desc])=><article className="ci-amenity" key={title}><span className="ci-amenity-icon"><Icon name={ico} size={26}/></span><h3>{title}</h3><p>{desc}</p></article>)}</div><div className="ci-feature-banner"><span className="ci-feature-banner-icon"><Icon name="spark" size={27}/></span><div><strong>It's the little things.</strong><p>The basics done well, with room to unwind.</p></div><a href="/request-stay">Plan your visit <Icon name="arrow" size={19}/></a></div></div></section>
   <section className="ci-section ci-rooms-section"><div className="ci-shell"><div className="ci-section-label"><span>03</span> A CLOSER LOOK <span className="ci-section-rule"/></div><div className="ci-section-head"><div><p className="ci-eyebrow">OUR HOTELS</p><h2>Find your kind of stay.</h2></div><p>Take a look around before you arrive. See real property details, room options, and what makes each stay different.</p></div>
   {featured.length?<div className="ci-featured-grid">{featured.map(h=><article className="ci-hotel-card" key={h.id}><div className="ci-hotel-card-image">{h.featured_image_url?<img src={h.featured_image_url} alt={'Guest room at '+h.display_name} loading="lazy"/>:<div className="ci-hotel-placeholder">CRYSTAL INN</div>}</div><div className="ci-hotel-card-content"><span className="ci-hotel-location">{h.city}, {h.region}</span><h3>{h.display_name}</h3><p>{h.description||'See the rooms, details, and location before you visit.'}</p><div className="ci-hotel-card-actions"><a href={'/hotels/'+encodeURIComponent(h.slug)}>View hotel →</a></div></div></article>)}</div>:<div className="ci-featured-empty"><p>More Crystal Inn properties will appear here soon.</p><a href="/#find-hotels">Browse all Crystal Inn locations →</a></div>}
   </div></section>
   <section className="ci-section ci-rewards-section"><div className="ci-shell"><div className="ci-section-label"><span>04</span> LOYALTY REWARDS <span className="ci-section-rule"/></div><div className="ci-rewards-feature"><div className="ci-rewards-copy"><p className="ci-eyebrow ci-on-dark">CRYSTAL INN REWARDS</p><h2>Good stays have their perks.</h2><p>Stay with us again and enjoy rewards at participating locations. Check your hotel's program before booking.</p><button className="ci-btn ci-btn-white" onClick={()=>change('rewards')}>Explore rewards <Icon name="arrow" size={18}/></button></div><RewardsCard/></div></div></section>
   <section className="ci-contact-section"><div className="ci-shell"><div className="ci-section-label"><span>05</span> HERE TO HELP <span className="ci-section-rule"/></div><div className="ci-bottom-grid"><article><div className="ci-bottom-symbol"><Icon name="map" size={26}/></div><p className="ci-eyebrow">ALL LOCATIONS</p><h3>Find us around Houston.</h3><p>See where we're located and pick the hotel that works for your plans.</p><div className="ci-location-links">{hotelOptions.map(h=><a key={h.id} href={'/hotels/'+encodeURIComponent(h.slug)}>{h.display_name} · {h.city}, {h.region} <Icon name="arrow" size={15}/></a>)}</div></article><article><div className="ci-bottom-symbol"><Icon name="gift" size={26}/></div><p className="ci-eyebrow">GET IN TOUCH</p><h3>Need a hand?</h3><p>Have a question about your stay? Get in touch and we'll help you find the right place to ask.</p><a href="mailto:frontdesk@crystalinnstay.com">frontdesk@crystalinnstay.com <Icon name="arrow" size={17}/></a></article></div></div></section>
  </>}
  {page==='rooms'&&<main className="ci-shell ci-inner"><p className="ci-eyebrow">OUR LOCATIONS</p><h1>Find the right Crystal Inn.</h1><p className="ci-inner-sub">Choose a property to see its room descriptions, photos and available booking options.</p><HotelDirectory compact/></main>}
  {page==='rewards'&&<main className="ci-shell ci-inner"><p className="ci-eyebrow">CRYSTAL INN REWARDS</p><h1>Rewards at participating hotels.</h1><p className="ci-inner-sub">Not every Crystal Inn location participates in rewards. Confirm the participating hotel before earning or redeeming points.</p>
  <div className="ci-reward-metrics"><article><Icon name="gift"/><strong>3</strong><span>Points per eligible $1 spent at a participating hotel</span></article><article><Icon name="credit"/><strong>1,000</strong><span>Minimum points required to redeem</span></article><article><Icon name="spark"/><strong>$10</strong><span>Illustrative hotel credit for 1,000 points, where offered under the program terms</span></article></div>
  <section className="ci-panel-reward"><h2>How rewards work</h2><p>At a participating Crystal Inn, eligible stays may earn 3 points per eligible dollar. Redemption begins at 1,000 points and is subject to the participating hotel's verified program terms. Points, stay history, and redemption are tracked separately by each hotel's Lumen guest account; they cannot currently be transferred between hotels.</p><h2>Participating Crystal Inn locations</h2>{hotelOptions.filter(h=>h.rewards_enabled===1).length?<div className="ci-participating">{hotelOptions.filter(h=>h.rewards_enabled===1).map(h=><a key={h.id} href={'/hotels/'+encodeURIComponent(h.slug)}>{h.display_name} · {h.city}, {h.region} →</a>)}</div>:<p>No participating locations have been published yet. Check with the individual hotel for current rewards eligibility.</p>}</section>
  <section className="ci-rewards-feature ci-inner-rewards"><div className="ci-rewards-copy"><p className="ci-eyebrow ci-on-dark">YOUR HOTEL ACCOUNT</p><h2>Earn where you stay.</h2><p>To check points and stay history, first choose the hotel. Guest login will be enabled once that hotel's Lumen connection is ready.</p><a className="ci-btn ci-btn-white" href="/guest/login">Sign in <Icon name="arrow" size={18}/></a></div><RewardsCard/></section></main>}
  {page==='reviews'&&<main className="ci-shell ci-inner"><p className="ci-eyebrow">GUEST EXPERIENCE</p><h1>Good stays are worth sharing.</h1><p className="ci-inner-sub">We're preparing verified guest feedback and a link to our official Google reviews. We won't display invented review counts or ratings.</p><div className="ci-bottom-grid ci-reviews-content"><article><span className="ci-bottom-symbol"><Icon name="star" size={26}/></span><h3>Google reviews</h3><p>Verified public reviews will appear after the hotel account is connected.</p></article><article><span className="ci-bottom-symbol"><Icon name="check" size={26}/></span><h3>Verified stay feedback</h3><p>Our own guest feedback feature will be tied to eligible completed stays.</p></article></div></main>}
  {page==='account'&&<main className="ci-shell ci-inner"><p className="ci-eyebrow">CRYSTAL INN GUEST ACCESS</p><h1>Your hotel. Your account.</h1><p className="ci-inner-sub">Each Crystal Inn maintains its own guest records and rewards through an independent Lumen PMS system. Choose your hotel before signing in.</p>
  <section className="ci-guest-select"><div className="ci-account-form-header"><span className="ci-icon-tile"><Icon name="map" size={25}/></span><h2>First, choose your hotel</h2><p>Accounts and stays at other Crystal Inn properties will not appear in this hotel's guest portal.</p></div><label htmlFor="guest-hotel">CHOOSE YOUR CRYSTAL INN HOTEL</label><select id="guest-hotel" value={selectedHotel} onChange={e=>setSelectedHotel(e.target.value)}><option value="">Select Crystal Inn location</option>{hotelOptions.map(h=><option key={h.id} value={h.slug}>{h.display_name} — {h.city}, {h.region}</option>)}</select>
 {selectedHotel&&<div className="ci-guest-next"><Icon name="shield" size={23}/><div><strong>Hotel selected</strong><p>Secure phone verification, stay history and rewards for this specific property will become available after its Lumen PMS connection is completed. No demo or unverified sign-in is offered.</p><a href={'/hotels/'+encodeURIComponent(selectedHotel)}>View selected hotel →</a></div></div>}</section>
 </main>}
  <footer className="ci-footer"><div className="ci-shell ci-footer-main"><div><div className="ci-footer-brand"><img src="/crystal-inn-logo.svg" width="42" height="42" alt=""/><strong>CRYSTAL INN</strong></div><p>Comfortable stays, without the fuss.</p></div><div><strong>Explore</strong><a href="/#find-hotels">Find a hotel</a><button onClick={()=>change('rooms')}>Hotels & locations</button><button onClick={()=>change('rewards')}>Rewards</button><a href="/guest/login">Sign in</a></div><div><strong>Contact & reservations</strong><a href="mailto:frontdesk@crystalinnstay.com">frontdesk@crystalinnstay.com</a><a href="/request-stay">Request a stay</a><span>Reservation requests require hotel confirmation.</span></div></div><div className="ci-shell ci-footer-bottom">© {new Date().getFullYear()} Crystal Inn Hotels <span>Made for easy stays.</span></div></footer>
 </div>;
}
