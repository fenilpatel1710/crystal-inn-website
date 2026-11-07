'use client';

import {useState} from 'react';

type Photo={id:string;slot:number;url:string};
type Props={
 roomName:string;
 imageUrl?:string|null;
 photos?:Photo[];
 onOpen:(photo:{url:string;alt:string})=>void;
};

function sizedImage(url:string,width:720|1600){
 // Gallery images are served from our own size-aware media endpoint.
 // External/legacy image URLs are left unchanged.
 if(!url.startsWith('/api/public/media/room?'))return url;
 const u=new URL(url,'https://crystalinnstay.com');
 u.searchParams.set('w',String(width));
 return u.pathname+u.search;
}

export default function RoomPhotoCarousel({roomName,imageUrl,photos,onOpen}:Props){
 const [active,setActive]=useState(0);
 const gallery=(photos||[]).slice().sort((a,b)=>a.slot-b.slot).map(p=>p.url);
 const available=gallery.length?gallery:imageUrl?[imageUrl]:[];
 const index=available.length?active%available.length:0;
 const current=available[index]||'';
 const hasGallery=available.length>1;
 const [failedUrl,setFailedUrl]=useState('');
 const preview=sizedImage(current,720);
 const failed=Boolean(preview&&preview===failedUrl);
 const change=(offset:number)=>{
  if(!hasGallery)return;
  setFailedUrl('');
  setActive(p=>(p+offset+available.length)%available.length);
 };
 return <div className="ci-property-room-image ci-room-carousel" aria-label={roomName+' room photos'}>
  {current&&!failed?
   <img src={preview} alt={roomName+' room photo '+(index+1)} loading="lazy" decoding="async"
    sizes="(max-width: 720px) 100vw, (max-width: 950px) 50vw, 33vw"
    onError={()=>setFailedUrl(preview)}/>
  :<div className="ci-property-image-placeholder" role="img" aria-label={roomName+' room photo unavailable'}>
    <span>CRYSTAL INN</span><small>Room photo coming soon</small>
   </div>}
  {hasGallery&&<>
   <button className="ci-gallery-arrow ci-gallery-prev" type="button"
    aria-label={'Previous photo of '+roomName} onClick={()=>change(-1)}>‹</button>
   <button className="ci-gallery-arrow ci-gallery-next" type="button"
    aria-label={'Next photo of '+roomName} onClick={()=>change(1)}>›</button>
  </>}
  {current&&!failed&&<button className="ci-gallery-view" type="button"
   aria-label={'Enlarge photo of '+roomName}
   onClick={()=>onOpen({url:sizedImage(current,1600),alt:roomName+' room photo '+(index+1)})}>
   View photo ↗
  </button>}
 </div>;
}
