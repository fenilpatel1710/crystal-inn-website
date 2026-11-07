'use client';
import {useEffect,useState,FormEvent} from 'react';
import RoomPhotoManager from '../../components/RoomPhotoManager';
import HotelMapTile from '../../components/HotelMapTile';
import {HOTEL_FEATURES,emptyFeatures,type FeatureFlags} from '../../lib/hotel-features';
import '../platform-admin/portal.css';
type Hotel={id:string;display_name:string;city:string;region:string};
type Room={id:string;display_name:string;description:string;image_url:string|null;is_active:number};
type Reservation={reference:string;guest_name:string;check_in:string;check_out:string;rooms_count:number;status:string};
type Rate={room_type_id:string;stay_date:string;rate_cents:number|null;allotment:number;stop_sell:number};
type GuestReview={id:string;rating:number;review_text:string;status:'published'|'hidden';created_at:string};
type GuestInquiry={id:string;guest_name:string;email:string;phone:string|null;subject:string;message:string;status:string;created_at:string};
type GoogleListing={placeId:string;name:string;address:string;mapsUrl:string};
export default function HotelAdmin(){
 const [notifyEmail,setNotifyEmail]=useState(''),[notifyPublicEmail,setNotifyPublicEmail]=useState('');
 const [notifyGuestEmail,setNotifyGuestEmail]=useState(true),[notifyGuestSms,setNotifyGuestSms]=useState(false);
 const [notifySupported,setNotifySupported]=useState(false),[notifyProviders,setNotifyProviders]=useState({email:false,sms:false});
 const [notifySummary,setNotifySummary]=useState<Array<{channel:string;state:string;total:number}>>([]);
 const [retryReference,setRetryReference]=useState(''),[notifyActionResult,setNotifyActionResult]=useState('');
 const [confirmReference,setConfirmReference]=useState(''),[confirmPmsCode,setConfirmPmsCode]=useState(''),[confirmVerified,setConfirmVerified]=useState(false);
 const [lumenStatus,setLumenStatus]=useState<{supported:boolean;enabled:boolean;configured:boolean;databaseScopeVerified:boolean}|null>(null);
 const [lumenTestResult,setLumenTestResult]=useState(''),[lumenTestBusy,setLumenTestBusy]=useState(false);
 const [features,setFeatures]=useState<FeatureFlags>(emptyFeatures());
 const [googlePlaceId,setGooglePlaceId]=useState(''),[googleReviewUrl,setGoogleReviewUrl]=useState('');
 const [googlePlacesKeyReady,setGooglePlacesKeyReady]=useState(false);
 const [googleRatingTest,setGoogleRatingTest]=useState('');
 const [googleRatingBusy,setGoogleRatingBusy]=useState(false);
 const [hotelInquiries,setHotelInquiries]=useState<GuestInquiry[]>([]);
 const [hotelInquiriesError,setHotelInquiriesError]=useState('');
 const [googleListings,setGoogleListings]=useState<GoogleListing[]>([]);
 const [googleSearchBusy,setGoogleSearchBusy]=useState(false),[googleSearchNotice,setGoogleSearchNotice]=useState('');
 const [googleSelectedListing,setGoogleSelectedListing]=useState('');
 async function checkGoogleRating(){
  setGoogleRatingBusy(true);setGoogleRatingTest('');
  try{
   const d=await request('/api/hotel/google-places/status');
   setGoogleRatingTest(d.ready
    ?'Connected: '+Number(d.rating).toFixed(1)+' stars ('+(d.userRatingCount??'unknown')+' Google ratings). Check the public Guest reviews tab.'
    :d.reason||'Google rating is unavailable.');
  }catch(e){setGoogleRatingTest(e instanceof Error?e.message:'Google Places test failed.')}
  finally{setGoogleRatingBusy(false)}
 }
 async function loadHotelInquiries(){
  try{const d=await request('/api/hotel/inquiries');setHotelInquiries(Array.isArray(d.inquiries)?d.inquiries:[]);setHotelInquiriesError('');}
  catch(e){setHotelInquiriesError(e instanceof Error?e.message:'Unable to load inquiries.');}
 }
 async function findGoogleListing(){
  setGoogleSearchBusy(true);setGoogleSearchNotice('');setGoogleListings([]);
  try{
   const d=await request('/api/hotel/google-places',{method:'POST',
    headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'search'})});
   setGoogleListings(Array.isArray(d.results)?d.results:[]);
   if(!d.results?.length)setGoogleSearchNotice('No matching Google listing found. Verify the street address under Hotel details or enter a Place ID manually.');
  }catch(e){setGoogleSearchNotice(e instanceof Error?e.message:'Google Places search unavailable.')}
  finally{setGoogleSearchBusy(false)}
 }
 async function chooseGoogleListing(placeId:string){
  setGoogleSearchBusy(true);setGoogleSearchNotice('');
  try{
   const d=await request('/api/hotel/google-places',{method:'POST',
    headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'details',placeId})});
   setGooglePlaceId(d.placeId);
   if(d.reviewUrl||d.mapsUrl)setGoogleReviewUrl(d.reviewUrl||d.mapsUrl);
   setGoogleSelectedListing([d.name,d.address].filter(Boolean).join(' · '));
   setGoogleListings([]);
   setGoogleSearchNotice('Google listing selected. Check the details, then click Save amenities and Google settings below.');
  }catch(e){setGoogleSearchNotice(e instanceof Error?e.message:'Could not verify the selected listing.')}
  finally{setGoogleSearchBusy(false)}
 }
 const [guestReviews,setGuestReviews]=useState<GuestReview[]>([]);
 const [forgotMode,setForgotMode]=useState(false),[forgotNotice,setForgotNotice]=useState('');
 const [locations,setLocations]=useState<Hotel[]>([]);const [hotelId,setHotelId]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [hotel,setHotel]=useState<Hotel|null>(null),[rooms,setRooms]=useState<Room[]>([]),[reservations,setReservations]=useState<Reservation[]>([]),[rates,setRates]=useState<Rate[]>([]);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[tab,setTab]=useState('reservations');
 const [profileImage,setProfileImage]=useState(''),[profileDescription,setProfileDescription]=useState(''),[profilePhone,setProfilePhone]=useState(''),[profileEmail,setProfileEmail]=useState(''),[profileAddress,setProfileAddress]=useState('');
 const [roomId,setRoomId]=useState(''),[roomName,setRoomName]=useState(''),[roomDescription,setRoomDescription]=useState(''),[roomImage,setRoomImage]=useState('');
 const [date,setDate]=useState(new Date().toISOString().slice(0,10)),[rate,setRate]=useState(''),[allotment,setAllotment]=useState('0'),[stopSell,setStopSell]=useState(false);
 async function request(url:string,init?:RequestInit){const r=await fetch(url,{...init,cache:'no-store'});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Request failed');return d}
 async function refresh(){try{const [d,r,p]=await Promise.all([request('/api/hotel/dashboard'),request('/api/hotel/rates'),request('/api/hotel/profile')]);setHotel(d.hotel);
 setProfileDescription(p.hotel?.description||'');setProfileImage(p.hotel?.hero_image_url||'');setProfilePhone(p.hotel?.public_phone||'');setProfileEmail(p.hotel?.public_email||'');setProfileAddress(p.hotel?.address_text||'');setRooms(d.rooms);setReservations(d.reservations);setRates(r.rates);
 // Optional feature/review tables require migration 0011. Existing hotel admin must still load without it.
 await Promise.all([loadFeatureSettings(),loadReviews(),loadLumenStatus(),loadReservationNotificationSettings(),loadHotelInquiries()]);
 }catch{setHotel(null)}}
 useEffect(()=>{void refresh();fetch('/api/hotel/locations').then(r=>r.json()).then(d=>{if(Array.isArray(d.hotels)){setLocations(d.hotels);if(d.hotels.length===1)setHotelId(d.hotels[0].id)}}).catch(()=>{})},[]);
 async function loadReservationNotificationSettings(){
  try{
   const d=await request('/api/hotel/reservation-notifications');
   setNotifySupported(Boolean(d.supported));setNotifyPublicEmail(d.publicEmail||'');
   setNotifyEmail(d.bookingNotificationEmail||'');setNotifyGuestEmail(Boolean(d.guestEmailEnabled));
   setNotifyGuestSms(Boolean(d.guestSmsEnabled));setNotifyProviders(d.providers||{email:false,sms:false});
   setNotifySummary(Array.isArray(d.deliverySummary)?d.deliverySummary:[]);
  }catch{setNotifySupported(false);setNotifySummary([])}
 }
 async function saveReservationNotifications(e:FormEvent){
  e.preventDefault();setBusy(true);setError('');setNotice('');
  try{
   await request('/api/hotel/reservation-notifications',{method:'PUT',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({bookingNotificationEmail:notifyEmail,guestEmailEnabled:notifyGuestEmail,guestSmsEnabled:notifyGuestSms})});
   setNotice('Reservation notification settings saved for this property.');await loadReservationNotificationSettings();
  }catch(e){setError(e instanceof Error?e.message:'Unable to save notification settings.')}finally{setBusy(false)}
 }
 async function retryNotifications(){
  setBusy(true);setError('');setNotifyActionResult('');
  try{
   const d=await request('/api/hotel/reservation-notifications',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({reference:retryReference.trim().toUpperCase()})});
   setNotifyActionResult('Provider acceptance: hotel email '+d.delivery.propertyEmail+', guest email '+d.delivery.guestEmail+', guest SMS '+d.delivery.guestSms+'.');
   await loadReservationNotificationSettings();
  }catch(e){setError(e instanceof Error?e.message:'Could not retry pending notifications.')}finally{setBusy(false)}
 }
 async function confirmPmsBooking(e:FormEvent){
  e.preventDefault();setBusy(true);setError('');setNotice('');
  try{
   const d=await request('/api/hotel/reservations/confirm',{method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({reference:confirmReference,lumenBookingReference:confirmPmsCode,confirmedInPms:confirmVerified})});
   setNotice('Hotel staff confirmed the PMS booking. Guest email: '+d.delivery.guestEmail+
    ', guest SMS: '+d.delivery.guestSms+'. Provider acceptance does not guarantee delivery.');
   setConfirmReference('');setConfirmPmsCode('');setConfirmVerified(false);
   await refresh();
  }catch(e){setError(e instanceof Error?e.message:'Unable to confirm the booking.')}finally{setBusy(false)}
 }
 async function loadLumenStatus(){
  try{const data=await request('/api/hotel/lumen/connection');setLumenStatus(data)}
  catch{setLumenStatus(null)}
 }
 async function testLumenConnection(){
  setLumenTestBusy(true);setLumenTestResult('');
  try{
   const d=await request('/api/hotel/lumen/connection',{method:'POST'});
   setLumenTestResult(d.status==='authenticated_cookie_received'
    ?'Lumen sign-in succeeded and the expected cookie was received. PMS database isolation is NOT verified yet.'
    :'Authentication test did not confirm a session.');
  }catch(e){setLumenTestResult(e instanceof Error?e.message:'Connection test unavailable.')}
  finally{setLumenTestBusy(false)}
 }
 async function loadFeatureSettings(){
  try{const d=await request('/api/hotel/features');setFeatures(d.features||emptyFeatures());
   setGooglePlaceId(d.googlePlaceId||'');setGoogleReviewUrl(d.googleReviewUrl||'');
   setGooglePlacesKeyReady(Boolean(d.googlePlacesApiConfigured));
  }catch{}
 }
 async function loadReviews(){
  try{const d=await request('/api/hotel/reviews');setGuestReviews(Array.isArray(d.reviews)?d.reviews:[])}catch{}
 }
 async function saveFeatures(e:FormEvent){
  e.preventDefault();setBusy(true);setError('');setNotice('');
  try{
   await request('/api/hotel/features',{method:'PUT',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({features,googlePlaceId,googleReviewUrl})});
   setNotice('Hotel amenities and Google review settings saved.');await loadFeatureSettings();
  }catch(e){setError(e instanceof Error?e.message:'Unable to save amenities. Check migration 0011.')}finally{setBusy(false)}
 }
 async function moderateReview(id:string,status:'published'|'hidden'){
  setBusy(true);setError('');setNotice('');
  try{
   await request('/api/hotel/reviews',{method:'PATCH',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({id,status})});
   setNotice(status==='hidden'?'Review hidden from public hotel page.':'Review restored to public hotel page.');
   await loadReviews();
  }catch(e){setError(e instanceof Error?e.message:'Could not moderate review.')}finally{setBusy(false)}
 }
 async function login(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{await request('/api/hotel/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({hotelId,email,password})});setPassword('');await refresh()}catch(e){setError(e instanceof Error?e.message:'Unable to sign in')}finally{setBusy(false)}}
 async function forgotPassword(e:FormEvent){e.preventDefault();setBusy(true);setError('');setForgotNotice('');
 try{const d=await request('/api/hotel/forgot-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});setForgotNotice(d.message||'If the manager account matches, an email will be sent.')}
 catch(e){setError(e instanceof Error?e.message:'Password recovery unavailable')}finally{setBusy(false)}
 }
 async function logout(){await request('/api/hotel/logout',{method:'POST'}).catch(()=>{});setHotel(null);setRooms([]);setReservations([])}
 async function saveProfile(e:FormEvent){e.preventDefault();setBusy(true);setError('');setNotice('');
 try{await request('/api/hotel/profile',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({description:profileDescription,heroImageUrl:profileImage,publicPhone:profilePhone,publicEmail:profileEmail,address:profileAddress})});setNotice('Hotel public profile updated.');await refresh()}
 catch(e){setError(e instanceof Error?e.message:'Could not update property')}
 finally{setBusy(false)}
 }
 async function saveRoom(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{await request('/api/hotel/rooms',{method:roomId?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:roomId,name:roomName,description:roomDescription,imageUrl:roomImage})});setNotice('Room details saved.');setRoomId('');setRoomName('');setRoomDescription('');setRoomImage('');await refresh()}catch(e){setError(e instanceof Error?e.message:'Unable to save')}finally{setBusy(false)}}
 async function saveRate(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{await request('/api/hotel/rates',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({roomId,date,rateCents:Math.round(Number(rate)*100),allotment:Number(allotment),stopSell})});setNotice('Rate and allotment saved.');await refresh()}catch(e){setError(e instanceof Error?e.message:'Unable to save')}finally{setBusy(false)}}
 function editRoom(r:Room){setRoomId(r.id);setRoomName(r.display_name);setRoomDescription(r.description||'');setRoomImage(r.image_url||'')}
 return <main className="ci-console"><header><a href="/">CRYSTAL INN</a><span>PROPERTY MANAGER</span>{hotel&&<button onClick={()=>void logout()}>Sign out</button>}</header>{!hotel?
 <div className="ci-auth"><p className="ci-kicker">PROPERTY ACCESS</p><h1>Hotel Admin</h1><p>Select your hotel and enter the manager credentials assigned by the platform administrator.</p>{forgotMode?<form onSubmit={forgotPassword}><p>Enter your manager email to request a one-time reset link. It expires after 30 minutes.</p><label>Manager email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><button disabled={busy}>Email reset link</button><button type="button" style={{marginLeft:10}} onClick={()=>setForgotMode(false)}>Back to sign in</button></form>:<form onSubmit={login}><label>Hotel<select required value={hotelId} onChange={e=>setHotelId(e.target.value)}><option value="">Select your hotel</option>{locations.map(h=><option key={h.id} value={h.id}>{h.display_name} — {h.city}, {h.region}</option>)}</select></label><label>Manager email<input type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Password<input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={busy}>Sign in</button></form>}<button type="button" onClick={()=>{setForgotMode(true);setForgotNotice("");setError("")}} style={{background:"transparent",border:0,color:"#184aaf",padding:"12px 0",cursor:"pointer"}}>Forgot password?</button>{forgotNotice&&<p role="status" className="ci-notice">{forgotNotice}</p>}{error&&<p role="alert" className="ci-error">{error}</p>}<p className="ci-small">Existing Northwest 290 staff can still use the legacy /admin portal until property migration is complete.</p></div>:
 <div className="ci-console-body"><p className="ci-kicker">PROPERTY CONTROL CENTER</p><h1>{hotel.display_name}</h1><p>{hotel.city}, {hotel.region} · Your account is restricted to this property.</p>{error&&<p role="alert" className="ci-error">{error}</p>}{notice&&<p role="status" className="ci-notice">{notice}</p>}
 <div className="ci-summary"><article><strong>{reservations.length}</strong>Reservation records</article><article><strong>{rooms.length}</strong>Room categories</article><article><strong>{rates.length}</strong>Nightly rate entries</article></div>
 <HotelMapTile hotelName={hotel.display_name} address={profileAddress} city={hotel.city} region={hotel.region} hotelId={hotel.id} placeId={googlePlaceId}/>
 <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:25}}>{[['reservations','Reservations'],['rooms','Rooms & descriptions'],['room-photos','Room photos'],['rates','Rates & availability'],['profile','Hotel details'],['features','Amenities & Google'],['inquiries','Guest inquiries'],['reviews','Guest reviews'],['notifications','Reservation notifications'],['lumen','Lumen API']].map(([key,label])=><button key={key} style={{padding:'12px 17px',border:'1px solid #d7e3ef',background:tab===key?'#173d70':'white',color:tab===key?'white':'#193b61',cursor:'pointer'}} onClick={()=>setTab(key)}>{label}</button>)}</div>
 {tab==='reservations'&&<section className="ci-panel"><h2>Hotel reservations</h2><p>Hotel-specific website records. Lumen PMS synchronization is not active.</p><div className="ci-table"><table><thead><tr><th>Reference</th><th>Guest</th><th>Check-in</th><th>Check-out</th><th>Rooms</th><th>Status</th></tr></thead><tbody>{reservations.map(r=><tr key={r.reference}><td>{r.reference}</td><td>{r.guest_name}</td><td>{r.check_in}</td><td>{r.check_out}</td><td>{r.rooms_count}</td><td>{r.status}</td></tr>)}</tbody></table></div>
  {notifySupported&&<form onSubmit={confirmPmsBooking} style={{marginTop:22}}>
   <h3>Confirm a website request after verifying it in Lumen</h3>
   <p>Before confirming, open Northwest 290's own Lumen PMS, check inventory/rate and create or locate the actual booking. Enter its real booking reference here. This does not create a Lumen reservation.</p>
   <label>Website stay request<select required value={confirmReference} onChange={e=>setConfirmReference(e.target.value)}>
    <option value="">Choose a request</option>
    {reservations.filter(r=>/^CI-[0-9A-F]{12}$/.test(r.reference)&&['request_received','pending_review','confirmed'].includes(r.status)).map(r=>
     <option key={r.reference} value={r.reference}>{r.reference} — {r.guest_name} — {r.check_in} ({r.status})</option>)}
   </select></label>
   <label>Confirmed Lumen booking reference<input required maxLength={80} value={confirmPmsCode}
    onChange={e=>setConfirmPmsCode(e.target.value)} placeholder="Reference shown in the Northwest 290 Lumen PMS"/></label>
   <label style={{flexDirection:'row',alignItems:'center',gap:10}}>
    <input type="checkbox" style={{width:'auto'}} checked={confirmVerified}
     onChange={e=>setConfirmVerified(e.target.checked)}/>
    I checked the correct Northwest 290 Lumen database and verified this booking is confirmed.
   </label>
   <button type="submit" disabled={busy||!confirmReference||!confirmVerified||confirmPmsCode.trim().length<3}>
    Confirm booking and notify guest
   </button>
   <p>Guest receives confirmed email and SMS (if separately opted in and provider configured). If a provider is unavailable, its delivery job remains pending for retry.</p>
  </form>}
 </section>}
 {tab==='profile'&&<section className="ci-panel"><h2>Your hotel's public page</h2><p>Changes below appear on your individual hotel's public page, not on other Crystal Inn properties.</p><form onSubmit={saveProfile}><label>Hotel description<textarea style={{padding:12,minHeight:125}} maxLength={1800} value={profileDescription} onChange={e=>setProfileDescription(e.target.value)}/></label><label>Hotel cover photo (HTTPS URL)<input type="url" maxLength={1000} value={profileImage} onChange={e=>setProfileImage(e.target.value)} placeholder="https://..."/></label><label>Public phone<input maxLength={32} value={profilePhone} onChange={e=>setProfilePhone(e.target.value)}/></label><label>Public email<input type="email" maxLength={190} value={profileEmail} onChange={e=>setProfileEmail(e.target.value)}/></label><label>Address (include city, state and ZIP)<input maxLength={250} value={profileAddress} onChange={e=>setProfileAddress(e.target.value)} placeholder="6850 Gessner Rd, Houston, TX 77040"/></label><button disabled={busy}>Save hotel details</button></form><p><a href={'/hotels/'+(hotel?.id==='crystal-inn-northwest-290'?'northwest-290':'')}>View hotel page</a></p></section>}
 {tab==='features'&&<section className="ci-panel"><h2>Amenities and guest services</h2>
 <p>Enable only services actually offered at this property. The hotel directory shows a check mark for enabled amenities and a blank box for those not enabled.</p>
 <form onSubmit={saveFeatures}>
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:12,margin:'20px 0'}}>
   {HOTEL_FEATURES.map(f=><label key={f.key} style={{display:'flex',flexDirection:'row',alignItems:'center',gap:10,padding:12,border:'1px solid #d9e5f0',borderRadius:6}}>
    <input type="checkbox" style={{width:'auto',height:18}} checked={features[f.key]} onChange={e=>setFeatures(p=>({...p,[f.key]:e.target.checked}))}/>
    {f.label}
   </label>)}
  </div>
  <p className="ci-small">Rewards is a participation flag, not a live Lumen points balance. Do not enable rewards without hotel approval.</p>
  <h2>Google Maps listing & guest reviews</h2>
  <p>Connect this hotel's correct Google listing to show real Google ratings and reviews, and give guests a direct Google review link. Choose your own property — never select another Crystal Inn location.</p>
  <div style={{border:'1px solid #d7e4ef',borderRadius:7,padding:'12px 16px',margin:'10px 0 18px',background:'#f9fcff'}}>
   <strong>Live Google rating setup</strong>
   <p style={{margin:'8px 0 2px'}}>Places API key: <strong>{googlePlacesKeyReady?'Detected in Cloudflare':'Not configured'}</strong></p>
   <p style={{margin:'2px 0 8px'}}>Hotel Place ID: <strong>{googlePlaceId.trim()?'Entered':'Not entered'}</strong></p>
   <small>Both are required for actual Google star ratings. A detected API key does not guarantee billing, API restrictions, or the selected Place ID are valid. Save the listing before testing.</small>
   <div style={{marginTop:12}}>
    <button type="button" disabled={busy||googleRatingBusy} onClick={()=>void checkGoogleRating()}>
     {googleRatingBusy?'Checking Google Places…':'Test live Google rating'}
    </button>
   </div>
   {googleRatingTest&&<p role="status" style={{margin:'12px 0 0'}}>{googleRatingTest}</p>}
  </div>
  <div style={{background:'#f2f7fc',border:'1px solid #d8e5f3',padding:17,borderRadius:8,margin:'12px 0 20px'}}>
   <h3 style={{margin:'0 0 8px'}}>Find this hotel's Google listing</h3>
   <p style={{margin:'0 0 12px'}}>Searching with the hotel name and address saved under Hotel details. Google Places API (New) must be enabled and GOOGLE_PLACES_API_KEY configured in Cloudflare. Search may incur Google Maps Platform usage charges.</p>
   <button type="button" disabled={busy||googleSearchBusy||!profileAddress.trim()} onClick={()=>void findGoogleListing()}>
    {googleSearchBusy?'Searching Google…':'Find this hotel on Google Maps'}
   </button>
   {!profileAddress.trim()&&<p className="ci-small">First enter the hotel's complete street address in Hotel details.</p>}
   {googleSearchNotice&&<p role="status" style={{margin:'12px 0',color:'#24486e'}}>{googleSearchNotice}</p>}
   {googleListings.length>0&&<div style={{display:'grid',gap:9,marginTop:15}} aria-label="Google Maps listing matches">
    {googleListings.map(item=><div key={item.placeId} style={{border:'1px solid #c9daed',background:'white',borderRadius:6,padding:12,display:'flex',gap:12,justifyContent:'space-between',alignItems:'center',flexWrap:'wrap'}}>
     <div><strong>{item.name}</strong><p style={{margin:'4px 0',fontSize:13}}>{item.address}</p>{item.mapsUrl&&<a href={item.mapsUrl} target="_blank" rel="noopener noreferrer">Verify on Google Maps ↗</a>}</div>
     <button type="button" disabled={googleSearchBusy} onClick={()=>void chooseGoogleListing(item.placeId)}>Use this listing</button>
    </div>)}
   </div>}
   {googleSelectedListing&&<p className="ci-small"><strong>Selected listing:</strong> {googleSelectedListing}</p>}
  </div>
  <label>Google Place ID<input maxLength={255} value={googlePlaceId} onChange={e=>setGooglePlaceId(e.target.value)} placeholder="Choose from search results or paste the hotel's official Place ID"/></label>
  <label>Google review / Maps link (optional)<input type="url" maxLength={1500} value={googleReviewUrl} onChange={e=>setGoogleReviewUrl(e.target.value)} placeholder="https://www.google.com/maps/..."/></label>
  <p className="ci-small">Selecting a result fills the real Place ID and official Google link when available. Click Save to publish changes. Real star ratings require the server-side GOOGLE_PLACES_API_KEY. Google Travel search links may not open the review composer directly.</p>
  <button disabled={busy}>Save amenities and Google settings</button>
 </form></section>}
 {tab==='inquiries'&&<section className="ci-panel">
  <h2>Guest inquiries for this hotel</h2>
  <p>Messages from Contact Crystal Inn that selected this specific property appear here. All inquiries are also saved in Super Admin → Guest Inquiries. Reservation requests are handled separately.</p>
  <button type="button" disabled={busy} onClick={()=>void loadHotelInquiries()}>Refresh inquiries</button>
  {hotelInquiriesError&&<p role="alert" className="ci-error">{hotelInquiriesError}</p>}
  {hotelInquiries.length===0&&!hotelInquiriesError&&<p>No guest inquiries submitted for this hotel yet.</p>}
  <div className="ci-table"><table><thead><tr><th>Date</th><th>Guest</th><th>Subject & message</th><th>Status</th></tr></thead>
   <tbody>{hotelInquiries.map(q=><tr key={q.id}>
    <td>{q.created_at}</td>
    <td>{q.guest_name}<p><a href={'mailto:'+q.email}>{q.email}</a></p><p>{q.phone||''}</p></td>
    <td><strong>{q.subject}</strong><p style={{whiteSpace:'pre-wrap',maxWidth:480,overflowWrap:'anywhere'}}>{q.message}</p></td>
    <td>{q.status.replaceAll('_',' ')}</td>
   </tr>)}</tbody>
  </table></div>
 </section>}
 {tab==='reviews'&&<section className="ci-panel"><h2>Guest website reviews</h2>
 <p>These are first-party reviews by SMS-verified hotel accounts. Phone verification does not prove a past stay. You may hide inappropriate content or restore it.</p>
 <button type="button" onClick={()=>void loadReviews()} disabled={busy}>Refresh reviews</button>
 <div className="ci-table"><table><thead><tr><th>Date</th><th>Stars</th><th>Review</th><th>Public status</th><th>Moderate</th></tr></thead><tbody>
 {guestReviews.map(r=><tr key={r.id}><td>{r.created_at.slice(0,10)}</td><td>{'★'.repeat(r.rating)}</td><td style={{whiteSpace:'pre-wrap',maxWidth:440,overflowWrap:'anywhere'}}>{r.review_text}</td><td>{r.status}</td>
 <td><button type="button" disabled={busy} onClick={()=>void moderateReview(r.id,r.status==='published'?'hidden':'published')}>{r.status==='published'?'Hide':'Restore'}</button></td></tr>)}
 </tbody></table></div>{!guestReviews.length&&<p>No guest reviews for this property yet.</p>}</section>}
 {tab==='notifications'&&<section className="ci-panel"><h2>Reservation email and SMS notifications</h2>
  <p>Each property receives only its own reservation requests. Northwest 290 booking requests are still reviewed by hotel staff; these messages never claim a confirmed room.</p>
  <form onSubmit={saveReservationNotifications}>
   <label>Property reservation inbox
    <input type="email" maxLength={190} placeholder={notifyPublicEmail||'frontdesk@example.com'}
     value={notifyEmail} onChange={e=>setNotifyEmail(e.target.value)}/>
   </label>
   <p>If left blank, the property public email is used: <strong>{notifyPublicEmail||'Not configured'}</strong>.</p>
   <label style={{flexDirection:'row',alignItems:'center',gap:10}}>
    <input type="checkbox" style={{width:'auto'}} checked={notifyGuestEmail} onChange={e=>setNotifyGuestEmail(e.target.checked)}/>
    Send guests a request-received email
   </label>
   <label style={{flexDirection:'row',alignItems:'center',gap:10}}>
    <input type="checkbox" style={{width:'auto'}} checked={notifyGuestSms} onChange={e=>setNotifyGuestSms(e.target.checked)}/>
    Enable guest SMS requests (only with their explicit opt-in)
   </label>
   <button type="submit" disabled={busy}>Save notification settings</button>
  </form>
  <p><strong>Email provider:</strong> {notifyProviders.email?'Configured':'Not configured'}.
   {' '}<strong>SMS provider:</strong> {notifyProviders.sms?'Configured':'Not configured'}.
   {' '}Guest SMS needs a separate Twilio Messaging Service, not only the Verify OTP service.</p>
  <p><strong>Online stay request submission:</strong> {notifySupported?'Available for this hotel (Northwest 290 pilot)':'Not enabled for this property yet'}.</p>
  <h3>Message statuses</h3>
  {notifySummary.length?<ul>{notifySummary.map(item=><li key={item.channel+item.state}>{item.channel.replace(/_/g,' ')} — {item.state}: {item.total}</li>)}</ul>:<p>No notification jobs found (or migration 0012 is pending).</p>}
  <h3>Retry a pending request message</h3>
  <p>Enter the website reference. Provider-accepted messages are never sent again. Uncertain Twilio processing states require a manual provider review to avoid duplicate texts.</p>
  <label>Reservation reference <input value={retryReference} maxLength={15} placeholder="CI-XXXXXXXXXXXX" onChange={e=>setRetryReference(e.target.value)}/></label>
  <button type="button" onClick={()=>void retryNotifications()} disabled={busy||!notifySupported||!/^(CI-)?[0-9A-Fa-f]{12}$/.test(retryReference.trim())}>Retry pending notices</button>
  {notifyActionResult&&<p role="status">{notifyActionResult}</p>}
  <p>Accepted means the email or SMS provider accepted the request. Actual delivery must be verified in the provider logs.</p>
 </section>}
 {tab==='lumen'&&<section className="ci-panel"><h2>Lumen API authentication</h2>
  <p>Northwest 290 read-only authentication pilot. The developer must configure a dedicated Lumen integration account using encrypted Cloudflare secrets. Guest lookup, ID images, and reservation writes remain disabled.</p>
  <p><strong>Hotel supported:</strong> {lumenStatus?.supported?'Yes':'No — pilot restricted to Northwest 290'}</p>
  <p><strong>Credentials configured:</strong> {lumenStatus?.configured?'Yes':'Not yet'}</p>
  <p><strong>Authentication test enabled:</strong> {lumenStatus?.enabled?'Yes':'No'}</p>
  <p><strong>Correct PMS database verified:</strong> No — Lumen developer must confirm database binding.</p>
  <button type="button" disabled={!lumenStatus?.supported||!lumenStatus?.enabled||!lumenStatus?.configured||lumenTestBusy}
   onClick={()=>void testLumenConnection()}>{lumenTestBusy?'Testing…':'Test Lumen sign-in'}</button>
  {lumenTestResult&&<p role="status" className="ci-notice">{lumenTestResult}</p>}
  <p className="ci-small">Test requires a hotel-manager account and is rate-limited. It never reveals the Lumen login password or session cookie. Successful sign-in alone does not authorize sharing guest history.</p>
 </section>}
 {tab==='rooms'&&<section className="ci-panel"><h2>Room types and descriptions</h2><div className="ci-table"><table><thead><tr><th>Room category</th><th>Description</th><th>Photo</th><th>Edit</th></tr></thead><tbody>{rooms.map(r=><tr key={r.id}><td>{r.display_name}</td><td>{r.description||'Not provided'}</td><td>{r.image_url?<a href={r.image_url} target="_blank" rel="noopener noreferrer">View photo</a>:'Not set'}</td><td><button onClick={()=>editRoom(r)}>Edit</button></td></tr>)}</tbody></table></div><form onSubmit={saveRoom}><h2>{roomId?'Edit room':'Add room category'}</h2><label>Room name<input required value={roomName} onChange={e=>setRoomName(e.target.value)}/></label><label>Description<textarea style={{padding:12,minHeight:100}} maxLength={2000} value={roomDescription} onChange={e=>setRoomDescription(e.target.value)}/></label><label>Legacy external room photo URL (optional — use Room photos to upload)<input type="url" value={roomImage} onChange={e=>setRoomImage(e.target.value)} placeholder="https://..."/></label><button disabled={busy}>Save room</button>{roomId&&<button type="button" style={{marginLeft:10,background:'#66788b'}} onClick={()=>{setRoomId('');setRoomName('');setRoomDescription('');setRoomImage('')}}>Cancel edit</button>}</form></section>}
 {tab==='room-photos'&&<section className="ci-panel"><h2>Photos for your room types</h2><p>Your uploads belong only to <strong>{hotel.display_name}</strong>. Select a room type from the dropdown below. The same three-photo limit applies to Super Admin and your property team.</p><RoomPhotoManager scope="hotel" hotelId={hotel.id} rooms={rooms}/></section>}
 {tab==='rates'&&<section className="ci-panel"><h2>Nightly rates and availability</h2><p>Changes are website inventory settings, not live Lumen changes.</p><form onSubmit={saveRate}><label>Room type<select required value={roomId} onChange={e=>setRoomId(e.target.value)}><option value="">Choose room</option>{rooms.map(r=><option value={r.id} key={r.id}>{r.display_name}</option>)}</select></label><label>Stay night<input type="date" required value={date} onChange={e=>setDate(e.target.value)}/></label><label>Rate (USD)<input required type="number" min="0" max="10000" step=".01" value={rate} onChange={e=>setRate(e.target.value)}/></label><label>Online rooms available<input type="number" min="0" max="1000" required value={allotment} onChange={e=>setAllotment(e.target.value)}/></label><label style={{flexDirection:'row',alignItems:'center'}}><input type="checkbox" style={{width:'auto'}} checked={stopSell} onChange={e=>setStopSell(e.target.checked)}/> Stop sell this room/date</label><button disabled={busy}>Save nightly settings</button></form><div className="ci-table"><table><thead><tr><th>Date</th><th>Room</th><th>Rate</th><th>Allotment</th><th>Stop sell</th></tr></thead><tbody>{rates.map(r=><tr key={r.room_type_id+r.stay_date}><td>{r.stay_date}</td><td>{rooms.find(x=>x.id===r.room_type_id)?.display_name||r.room_type_id}</td><td>{r.rate_cents==null?'—':'$'+(r.rate_cents/100).toFixed(2)}</td><td>{r.allotment}</td><td>{r.stop_sell?'Yes':'No'}</td></tr>)}</tbody></table></div></section>}
 </div>}</main>
}