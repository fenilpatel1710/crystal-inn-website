'use client';
import {useEffect,useId,useRef,useState} from 'react';

type Hotel={id:string;slug:string;display_name:string;city:string;region:string;description:string;hero_image_url:string|null;public_phone?:string;is_legacy_booking?:boolean};
type Suggestion={id:string;label:string;detail:string;search:string;type:'location'|'hotel'};
function HotelPhoto({hotel}:{hotel:Hotel}){
 const [failed,setFailed]=useState(false);
 return hotel.hero_image_url&&!failed
  ?<img src={hotel.hero_image_url} alt={hotel.display_name} loading="lazy" onError={()=>setFailed(true)}/>
  :<div className="ci-hotel-placeholder" aria-label={'Photo coming soon for '+hotel.display_name}><span>CRYSTAL INN</span><small>Property photo coming soon</small></div>;
}
export default function HotelDirectory({compact=false}:{compact?:boolean}){
 const [hotels,setHotels]=useState<Hotel[]>([]);
 const [query,setQuery]=useState(''),[loading,setLoading]=useState(true),[loadError,setLoadError]=useState('');
 const [suggestionsOpen,setSuggestionsOpen]=useState(false),[activeIndex,setActiveIndex]=useState(-1);
 const inputRef=useRef<HTMLInputElement>(null);
 const listId=useId();
 useEffect(()=>{let alive=true;fetch('/api/public/hotels',{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok||d.setupPending)throw Error('Hotel listings are temporarily unavailable. Please contact guest services.');if(alive)setHotels(Array.isArray(d.hotels)?d.hotels:[])})
 .catch(e=>{if(alive)setLoadError(e instanceof Error?e.message:'Unable to load locations.')}).finally(()=>{if(alive)setLoading(false)});
 return()=>{alive=false}},[]);
 const term=query.trim().toLowerCase();
 const searchable=(h:Hotel)=>(h.display_name+' '+h.city+' '+h.region).toLowerCase();
 const shown=hotels.filter(h=>searchable(h).includes(term));
 const suggestions:Suggestion[]=[];
 if(term&&!loading&&!loadError){
  const seenCities=new Set<string>();
  for(const h of hotels){
   const city=h.city.trim()+', '+h.region.trim();
   if(city.toLowerCase().includes(term)&&!seenCities.has(city.toLowerCase())){
    seenCities.add(city.toLowerCase());
    suggestions.push({id:'city:'+city.toLowerCase(),label:city,detail:'Location',search:h.city,type:'location'});
   }
  }
  for(const h of hotels){
   if(searchable(h).includes(term)){
    suggestions.push({id:'hotel:'+h.id,label:h.display_name,detail:h.city+', '+h.region,search:h.display_name,type:'hotel'});
   }
  }
 }
 const suggested=suggestions.slice(0,8);
 const visible=suggestionsOpen&&term.length>0&&!loading&&!loadError;
 const choose=(suggestion:Suggestion)=>{setQuery(suggestion.search);setSuggestionsOpen(false);setActiveIndex(-1);inputRef.current?.focus()};
 function onKeyDown(e:React.KeyboardEvent<HTMLInputElement>){
  if(e.key==='Escape'){setSuggestionsOpen(false);setActiveIndex(-1);return}
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){
   if(!suggested.length)return;
   e.preventDefault();setSuggestionsOpen(true);
   setActiveIndex(index=>e.key==='ArrowDown'?(index+1)%suggested.length:index<=0?suggested.length-1:index-1);
  }else if(e.key==='Enter'&&visible&&activeIndex>=0&&suggested[activeIndex]){
   e.preventDefault();choose(suggested[activeIndex]);
  }
 }
 return <section className={compact?'ci-hotels ci-hotels-compact':'ci-hotels'} id="find-hotels"><div className="ci-shell">
 <div className="ci-section-label"><span>01</span> OUR LOCATIONS <span className="ci-section-rule"/></div>
 <div className="ci-section-head"><div><p className="ci-eyebrow">EXPLORE CRYSTAL INN</p><h2>Find your Crystal Inn.</h2></div><p>Each location has its own rooms, team, rates and guest experience. Choose the hotel that suits your plans.</p></div>
 <div className="ci-hotel-search-wrap">
  <label className="ci-hotel-search" htmlFor={listId+'-search'}><span>SEARCH BY CITY OR HOTEL</span></label>
  <div className="ci-hotel-search-field">
   <input ref={inputRef} id={listId+'-search'} type="search" placeholder="Try Houston or Northwest 290..." value={query}
    role="combobox" aria-autocomplete="list" aria-expanded={visible&&suggested.length>0}
    aria-controls={listId+'-options'} aria-activedescendant={visible&&activeIndex>=0&&suggested[activeIndex]?listId+'-option-'+activeIndex:undefined}
    autoComplete="off" onFocus={()=>setSuggestionsOpen(true)} onBlur={()=>{setSuggestionsOpen(false);setActiveIndex(-1)}}
    onChange={e=>{setQuery(e.target.value);setActiveIndex(-1);setSuggestionsOpen(true)}} onKeyDown={onKeyDown}/>
   {visible&&<div className="ci-hotel-suggestions" id={listId+'-options'} role="listbox" aria-label="Matching Crystal Inn hotels and cities">
    {suggested.length? suggested.map((item,index)=><button type="button" role="option" aria-selected={activeIndex===index}
     id={listId+'-option-'+index} className={'ci-hotel-suggestion'+(activeIndex===index?' is-active':'')} key={item.id}
     onMouseDown={e=>e.preventDefault()} onClick={()=>choose(item)}>
     <span><strong>{item.label}</strong><small>{item.detail}</small></span><span aria-hidden="true">↗</span>
    </button>):<p className="ci-hotel-suggestions-empty">No matching locations. Try a different city or hotel name.</p>}
   </div>}
  </div>
 </div>
 <div className="ci-hotel-list">{shown.map(h=><article className="ci-hotel-card" key={h.id}>
 <div className="ci-hotel-card-image"><HotelPhoto hotel={h}/></div>
 <div className="ci-hotel-card-content"><span className="ci-hotel-location">{h.city}, {h.region}</span><h3>{h.display_name}</h3><p>{h.description||'Discover rooms, amenities and local hospitality at this Crystal Inn location.'}</p>
 <div className="ci-hotel-card-actions"><a href={'/hotels/'+encodeURIComponent(h.slug)}>Explore hotel →</a>{h.is_legacy_booking&&<a href={'/request-stay?hotel='+encodeURIComponent(h.slug)} className="ci-hotel-request">Request a stay</a>}</div></div></article>)}</div>
 {loading?<p className="ci-hotel-empty">Loading Crystal Inn locations…</p>:loadError?<p role="alert" className="ci-hotel-empty">{loadError} <a href="/contact">Contact guest services</a></p>:hotels.length===0?<p className="ci-hotel-empty">No Crystal Inn locations are currently published. Please check back or <a href="/contact">contact guest services</a>.</p>:!shown.length?<p className="ci-hotel-empty">No hotels match “{query}”. <button type="button" onClick={()=>{setQuery('');setSuggestionsOpen(false)}} style={{border:0,background:'transparent',textDecoration:'underline',color:'#184aaf',cursor:'pointer'}}>Clear search</button></p>:null}
 </div></section>
}
