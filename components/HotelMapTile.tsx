'use client';

type Props={
 hotelName:string;
 address:string;
 city:string;
 region:string;
 placeId?:string;
 compact?:boolean;
};

export default function HotelMapTile({hotelName,address,city,region,placeId='',compact=false}:Props){
 // Never pin the centre of a city when the hotel has no street address.
 const street=address.trim();
 const query=[hotelName,street,city,region].filter(Boolean).join(', ');
 const iframeUrl='https://www.google.com/maps?q='+encodeURIComponent(query)+'&z=16&output=embed';
 const mapsUrl='https://www.google.com/maps/search/?'+new URLSearchParams({
  api:'1',
  query,
  ...(placeId?{query_place_id:placeId}:{})
 }).toString();
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
   {street?<iframe
    title={'Interactive Google Maps location for '+hotelName}
    src={iframeUrl}
    loading="lazy"
    referrerPolicy="strict-origin-when-cross-origin"
    allowFullScreen
    style={{display:'block',border:0,borderRadius:8,width:'100%',height:compact?265:325}}
   />:<div style={{border:'1px dashed #b4c7db',borderRadius:8,padding:30,color:'#617791',background:'#f8fbfe'}}>
    Map preview unavailable until a street address is saved for this hotel.
   </div>}
   {street&&<p style={{margin:'11px 0 0',fontSize:12,color:'#667990'}}>
    Use the Google Maps controls to zoom in, zoom out, or explore nearby streets.
    {placeId?' The “Open in Google Maps” link uses the saved Place ID.':' Check the map location and save the correct Google Place ID under Amenities & Google if needed.'}
   </p>}
  </section>;
}
