'use client';

import {useState} from 'react';

type Props={
 hotelName:string;
 address:string;
 city:string;
 region:string;
 placeId?:string;
 compact?:boolean;
};

export default function HotelMapTile({hotelName,address,city,region,placeId='',compact=false}:Props){
 const [zoom,setZoom]=useState(16);
 // Never place a city-centre pin when no street address has been provided.
 const street=address.trim();
 const query=[hotelName,street,city,region].filter(Boolean).join(', ');
 const iframeUrl='https://www.google.com/maps?q='+encodeURIComponent(query)+'&z='+zoom+'&output=embed';
 const mapsUrl='https://www.google.com/maps/search/?'+new URLSearchParams({
  api:'1',query,...(placeId?{query_place_id:placeId}:{})
 }).toString();
 const buttonStyle={
  display:'block',width:39,height:39,border:0,background:'#fff',color:'#183d66',
  fontSize:25,fontWeight:600,cursor:'pointer'
 } as const;
 return <section className="ci-property-map-tile" aria-label={'Google Maps location for '+hotelName}
  style={{border:'1px solid #dae6f2',borderRadius:10,background:'#fff',padding:compact?16:22,margin:'20px 0 24px',overflow:'hidden'}}>
   <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:16,flexWrap:'wrap',marginBottom:14}}>
    <div>
     <h2 style={{margin:'0 0 7px',color:'#153c69',fontSize:23}}>Hotel location · Google Maps</h2>
     <p style={{margin:'0 0 4px',color:'#3b5c7a',fontWeight:700}}>{hotelName}</p>
     <p style={{margin:0,color:'#617791'}}>{street||'Complete the street address under Hotel details to display this property on the map.'}</p>
    </div>
    {street&&<a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{color:'#134d92',fontWeight:700}}>Open in Google Maps ↗</a>}
   </div>
   {street?<div style={{position:'relative'}}>
    <iframe
     title={'Interactive Google Maps location for '+hotelName}
     src={iframeUrl}
     loading="lazy"
     referrerPolicy="strict-origin-when-cross-origin"
     allowFullScreen
     style={{display:'block',border:0,borderRadius:8,width:'100%',height:compact?265:325}}
    />
    <div role="group" aria-label="Map zoom controls" style={{
     position:'absolute',right:12,top:12,zIndex:2,display:'grid',
     border:'1px solid #dae3ed',borderRadius:7,overflow:'hidden',
     boxShadow:'0 2px 9px #122b3d3d',background:'#fff'
    }}>
     <button type="button" aria-label="Zoom in on hotel map" title="Zoom in"
      disabled={zoom>=20} style={{...buttonStyle,opacity:zoom>=20?.4:1}}
      onClick={()=>setZoom(z=>Math.min(20,z+1))}>+</button>
     <span aria-hidden="true" style={{height:1,background:'#dbe3ec'}}/>
     <button type="button" aria-label="Zoom out on hotel map" title="Zoom out"
      disabled={zoom<=10} style={{...buttonStyle,opacity:zoom<=10?.4:1}}
      onClick={()=>setZoom(z=>Math.max(10,z-1))}>−</button>
    </div>
   </div>:<div style={{border:'1px dashed #b4c7db',borderRadius:8,padding:30,color:'#617791',background:'#f8fbfe'}}>
    Map preview unavailable until a street address is saved for this hotel.
   </div>}
   {street&&<p style={{margin:'11px 0 0',fontSize:12,color:'#667990'}}>
    Use + and − to zoom, drag the map to explore nearby streets, or open the full Google Maps view.
    {placeId?' The Google Maps link uses this hotel’s saved Place ID.':' Verify the marker and save the correct Google Place ID under Amenities & Google.'}
   </p>}
  </section>;
}
