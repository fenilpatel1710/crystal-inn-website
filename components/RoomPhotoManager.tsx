'use client';

import {useEffect,useRef,useState,FormEvent} from 'react';
import '../app/platform-admin/portal.css';

type Room={id:string;display_name:string};
type Photo={id:string;slot:number;url:string};
type Props={scope:'platform'|'hotel';hotelId:string;rooms:Room[]};

const MAX_BYTES=5*1024*1024;
export default function RoomPhotoManager({scope,hotelId,rooms}:Props){
 const [roomId,setRoomId]=useState('');
 const [photos,setPhotos]=useState<Photo[]>([]);
 const [selected,setSelected]=useState<File|null>(null);
 const [preview,setPreview]=useState('');
 const [loading,setLoading]=useState(false),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const fileInput=useRef<HTMLInputElement>(null);

 useEffect(()=>{
  setRoomId('');setPhotos([]);setSelected(null);setError('');setNotice('');
  if(fileInput.current)fileInput.current.value='';
 },[hotelId]);
 useEffect(()=>{
  if(roomId&&!rooms.some(r=>r.id===roomId)){setRoomId('');setPhotos([])}
 },[roomId,rooms]);
 useEffect(()=>{
  if(!selected){setPreview('');return}
  const url=URL.createObjectURL(selected);
  setPreview(url);
  return()=>URL.revokeObjectURL(url);
 },[selected]);
 const endpoint='/api/management/room-photos?scope='+scope;
 async function refreshPhotos(id:string){
  if(!id||!hotelId){setPhotos([]);return}
  setLoading(true);setError('');
  try{
   const query=new URLSearchParams({hotelId,roomId:id});
   const response=await fetch(endpoint+'&'+query,{cache:'no-store'});
   const json=await response.json();
   if(!response.ok)throw Error(json.error||'Could not load photos');
   setPhotos(Array.isArray(json.photos)?json.photos:[]);
  }catch(e){setPhotos([]);setError(e instanceof Error?e.message:'Cannot load room photos')}
  finally{setLoading(false)}
 }
 useEffect(()=>{void refreshPhotos(roomId)},[scope,hotelId,roomId]);
 function selectRoom(id:string){
  setRoomId(id);setSelected(null);setNotice('');setError('');
  if(fileInput.current)fileInput.current.value='';
 }
 async function upload(e:FormEvent){
  e.preventDefault();
  if(!roomId||!hotelId||!selected||busy||photos.length>=3)return;
  if(selected.size>MAX_BYTES||selected.size===0){setError('Choose a photo no larger than 5 MB.');return}
  setBusy(true);setError('');setNotice('');
  try{
   const data=new FormData();
   data.append('hotelId',hotelId);data.append('roomId',roomId);data.append('photo',selected);
   const response=await fetch(endpoint,{method:'POST',body:data,cache:'no-store'});
   const json=await response.json();
   if(!response.ok)throw Error(json.error||'Upload failed');
   setSelected(null);if(fileInput.current)fileInput.current.value='';
   await refreshPhotos(roomId);
   setNotice('Photo uploaded to this room type. Other rooms remain unchanged.');
  }catch(e){setError(e instanceof Error?e.message:'Upload failed')}
  finally{setBusy(false)}
 }
 async function remove(photo:Photo){
  const room=rooms.find(r=>r.id===roomId)?.display_name||'this room';
  if(!window.confirm('Remove photo '+photo.slot+' from '+room+'?'))return;
  setBusy(true);setError('');setNotice('');
  try{
   const response=await fetch(endpoint,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({hotelId,roomId,photoId:photo.id}),cache:'no-store'});
   const json=await response.json();
   if(!response.ok)throw Error(json.error||'Could not remove photo');
   await refreshPhotos(roomId);
   setNotice('Room photo removed. You can now upload a replacement.');
  }catch(e){setError(e instanceof Error?e.message:'Could not remove photo')}
  finally{setBusy(false)}
 }
 const selectedRoom=rooms.find(r=>r.id===roomId);
 return <section className="ci-room-photo-manager" aria-label="Manage room photos">
  <div className="ci-room-photo-heading"><div><h3>Room photo gallery</h3><p>Choose the room type first, then upload up to <strong>3 photos</strong> for that room. Images are stored privately in Cloudflare R2; only this room's approved images appear on its hotel page.</p></div>{roomId&&<strong className="ci-room-photo-counter">{photos.length} / 3 photos</strong>}</div>
  <label>Room type
   <select value={roomId} onChange={e=>selectRoom(e.target.value)} disabled={!hotelId||busy}>
    <option value="">Select a room type</option>
    {rooms.map(room=><option key={room.id} value={room.id}>{room.display_name}</option>)}
   </select>
  </label>
  {!rooms.length&&<p className="ci-small">Add a room category first, then return here to upload its photos.</p>}
  {roomId&&<><p className="ci-room-photo-context">Selected room: <strong>{selectedRoom?.display_name}</strong>. Photos cannot be uploaded to a different room without changing this selection.</p>
   {loading?<p>Loading room gallery…</p>:<div className="ci-room-photo-grid">
    {photos.map(photo=><article key={photo.id} className="ci-room-photo-tile">
     <img src={photo.url} alt={'Photo '+photo.slot+' of '+(selectedRoom?.display_name||'room')} loading="lazy"/>
     <div><strong>Photo {photo.slot}</strong><button type="button" disabled={busy} onClick={()=>void remove(photo)}>Remove</button></div>
    </article>)}
    {Array.from({length:Math.max(0,3-photos.length)},(_,index)=><div key={'empty-'+index} className="ci-room-photo-empty">Photo slot available</div>)}
   </div>}
   <form onSubmit={upload} className="ci-room-photo-form">
    <label>Upload photo to {selectedRoom?.display_name||'selected room'} (JPG, PNG, WebP — max 5 MB)
     <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" required disabled={busy||loading||photos.length>=3} onChange={e=>setSelected(e.target.files?.[0]||null)}/>
    </label>
    {preview&&<div className="ci-room-photo-selection"><img src={preview} alt="Selected photo preview"/><div><strong>{selected?.name}</strong><p>{((selected?.size||0)/1048576).toFixed(2)} MB</p></div></div>}
    <button type="submit" disabled={busy||loading||!selected||photos.length>=3||selected.size>MAX_BYTES||selected.size===0}>{busy?'Saving photo…':'Upload photo to '+(selectedRoom?.display_name||'this room')}</button>
    {photos.length>=3&&<p className="ci-small">This room has reached its 3-photo limit. Remove one photo to upload another.</p>}
   </form>
  </>}
  {error&&<p role="alert" className="ci-error">{error}</p>}
  {notice&&<p role="status" className="ci-notice">{notice}</p>}
 </section>;
}
