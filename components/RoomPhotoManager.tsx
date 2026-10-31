'use client';

import {useEffect,useRef,useState,FormEvent} from 'react';
import '../app/platform-admin/portal.css';

type Room={id:string;display_name:string};
type Photo={id:string;slot:number;url:string;assetId:string};
type Asset={id:string;url:string;assignedCount:number;createdAt:string;status:'active'|'deleting'};
type Props={scope:'platform'|'hotel';hotelId:string;rooms:Room[]};
const MAX_BYTES=5*1024*1024;
export default function RoomPhotoManager({scope,hotelId,rooms}:Props){
 const [roomId,setRoomId]=useState('');
 const [photos,setPhotos]=useState<Photo[]>([]);
 const [library,setLibrary]=useState<Asset[]>([]);
 const [selected,setSelected]=useState<File|null>(null);
 const [preview,setPreview]=useState('');
 const [mode,setMode]=useState<'library'|'upload'>('library');
 const [loading,setLoading]=useState(false),[loadingLibrary,setLoadingLibrary]=useState(false),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const fileInput=useRef<HTMLInputElement>(null);
 const endpoint='/api/management/room-photos?scope='+scope;
 useEffect(()=>{
  setRoomId('');setPhotos([]);setLibrary([]);setSelected(null);setError('');setNotice('');
  if(fileInput.current)fileInput.current.value='';
 },[hotelId]);
 useEffect(()=>{if(roomId&&!rooms.some(r=>r.id===roomId)){setRoomId('');setPhotos([])}},[roomId,rooms]);
 useEffect(()=>{
  if(!selected){setPreview('');return}
  const url=URL.createObjectURL(selected);setPreview(url);
  return()=>URL.revokeObjectURL(url);
 },[selected]);
 async function refreshPhotos(id:string){
  if(!id||!hotelId){setPhotos([]);return}
  setLoading(true);setError('');
  try{
   const query=new URLSearchParams({hotelId,roomId:id});
   const r=await fetch(endpoint+'&'+query,{cache:'no-store'});const j=await r.json();
   if(!r.ok)throw Error(j.error||'Could not load room photos.');
   setPhotos(Array.isArray(j.photos)?j.photos:[]);
  }catch(e){setPhotos([]);setError(e instanceof Error?e.message:'Could not load room photos.')}
  finally{setLoading(false)}
 }
 async function refreshLibrary(){
  if(!hotelId){setLibrary([]);return}
  setLoadingLibrary(true);
  try{
   const query=new URLSearchParams({hotelId,library:'1'});
   const r=await fetch(endpoint+'&'+query,{cache:'no-store'});const j=await r.json();
   if(!r.ok)throw Error(j.error||'Could not load photo library.');
   setLibrary(Array.isArray(j.assets)?j.assets:[]);
  }catch(e){setLibrary([]);setError(e instanceof Error?e.message:'Could not load photo library.')}
  finally{setLoadingLibrary(false)}
 }
 useEffect(()=>{void refreshPhotos(roomId)},[scope,hotelId,roomId]);
 useEffect(()=>{void refreshLibrary()},[scope,hotelId]);
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
   if(!response.ok)throw Error(json.error||'Upload failed.');
   setSelected(null);if(fileInput.current)fileInput.current.value='';
   await refreshPhotos(roomId);await refreshLibrary();
   setNotice('Photo uploaded and added to this hotel’s library. You can reuse it in another room type.');
   setMode('library');
  }catch(e){setError(e instanceof Error?e.message:'Upload failed.')}
  finally{setBusy(false)}
 }
 async function reuse(asset:Asset){
  if(!roomId||!hotelId||busy||photos.length>=3||photos.some(p=>p.assetId===asset.id))return;
  setBusy(true);setError('');setNotice('');
  try{
   const response=await fetch(endpoint,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({hotelId,roomId,assetId:asset.id}),cache:'no-store'});
   const json=await response.json();if(!response.ok)throw Error(json.error||'Could not reuse photo.');
   await refreshPhotos(roomId);await refreshLibrary();
   setNotice('Existing photo assigned to this room without uploading another copy.');
  }catch(e){setError(e instanceof Error?e.message:'Could not reuse photo.')}
  finally{setBusy(false)}
 }
 async function permanentDelete(asset:Asset){
  if(busy||asset.assignedCount>0)return;
  const description=asset.status==='deleting'?'Retry deleting the stored photo from R2?':
   'Permanently delete this unused photo from Cloudflare R2 storage? This cannot be undone.';
  if(!window.confirm(description))return;
  setBusy(true);setError('');setNotice('');
  try{
   const response=await fetch(endpoint,{method:'DELETE',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'delete_asset',hotelId,assetId:asset.id}),cache:'no-store'});
   const json=await response.json();
   if(!response.ok)throw Error(json.error||'Photo deletion failed.');
   await refreshLibrary();
   if(roomId)await refreshPhotos(roomId);
   setNotice('Photo permanently deleted from the hotel library and R2 storage.');
  }catch(e){
   setError(e instanceof Error?e.message:'Photo deletion failed.');
   await refreshLibrary();
  }finally{setBusy(false)}
 }
 async function remove(photo:Photo){
  const room=rooms.find(r=>r.id===roomId)?.display_name||'this room';
  if(!window.confirm('Remove photo '+photo.slot+' from '+room+'? It will remain in your hotel library and any other rooms using it.'))return;
  setBusy(true);setError('');setNotice('');
  try{
   const r=await fetch(endpoint,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({hotelId,roomId,photoId:photo.id}),cache:'no-store'});
   const j=await r.json();if(!r.ok)throw Error(j.error||'Could not remove photo.');
   await refreshPhotos(roomId);await refreshLibrary();
   setNotice('Photo removed from this room. The library image and other rooms are unchanged.');
  }catch(e){setError(e instanceof Error?e.message:'Could not remove photo.')}
  finally{setBusy(false)}
 }
 const selectedRoom=rooms.find(r=>r.id===roomId);
 const alreadyAssigned=new Set(photos.map(p=>p.assetId));
 return <section className="ci-room-photo-manager" aria-label="Manage room photos">
  <div className="ci-room-photo-heading"><div><h3>Room photo manager</h3><p>Select a room type and either upload a new photo or reuse one from this hotel's existing photo library. The same image can appear in different room types with different amenities. Maximum <strong>3 photos per room type</strong>.</p></div>{roomId&&<strong className="ci-room-photo-counter">{photos.length} / 3 photos</strong>}</div>
  <label>Room type<select value={roomId} onChange={e=>selectRoom(e.target.value)} disabled={!hotelId||busy}>
   <option value="">Select a room type</option>{rooms.map(room=><option key={room.id} value={room.id}>{room.display_name}</option>)}
  </select></label>
  {!rooms.length&&<p className="ci-small">Add a room category before assigning its photos.</p>}
  {!roomId&&<div className="ci-photo-library" style={{marginTop:20}}>
   <div className="ci-photo-library-title"><strong>Hotel photo library · storage cleanup</strong>
    <button type="button" disabled={busy||loadingLibrary} onClick={()=>void refreshLibrary()}>Refresh library</button>
   </div>
   <p className="ci-small">Select a room above to add photos. You can permanently delete unused images here without choosing a room.</p>
   {loadingLibrary?<p>Loading photos…</p>:library.length?<div className="ci-photo-library-grid">
    {library.map(asset=><article key={asset.id} className="ci-photo-library-item">
     {asset.status==='deleting'?<div className="ci-photo-library-pending">Deletion pending</div>:<img src={asset.url} alt="Hotel library photo" loading="lazy"/>}
     <div><small>{asset.assignedCount} room assignment{asset.assignedCount===1?'':'s'}</small>
      <button type="button" className="ci-photo-library-delete" disabled={busy||asset.assignedCount>0}
       onClick={()=>void permanentDelete(asset)}>{asset.status==='deleting'?'Retry deletion':'Delete permanently'}</button>
      {asset.assignedCount>0&&<small>Remove from all rooms before permanently deleting.</small>}
     </div>
    </article>)}
   </div>:<p className="ci-small">No photos in the hotel library.</p>}
  </div>}
  {roomId&&<>
   <p className="ci-room-photo-context">Selected room: <strong>{selectedRoom?.display_name}</strong>. Photos are saved to this room type only.</p>
   {loading?<p>Loading room gallery…</p>:<div className="ci-room-photo-grid">
    {photos.map(photo=><article key={photo.id} className="ci-room-photo-tile">
     <img src={photo.url} alt={'Photo '+photo.slot+' of '+(selectedRoom?.display_name||'room')} loading="lazy"/>
     <div><strong>Photo {photo.slot}</strong><button type="button" disabled={busy} onClick={()=>void remove(photo)}>Remove</button></div>
    </article>)}
    {Array.from({length:Math.max(0,3-photos.length)},(_,index)=><div key={'empty-'+index} className="ci-room-photo-empty">Photo slot available</div>)}
   </div>}
   <div className="ci-room-photo-source-tabs" role="group" aria-label="Photo source">
    <button type="button" className={mode==='library'?'active':''} aria-pressed={mode==='library'} onClick={()=>setMode('library')}>Choose from uploaded photos</button>
    <button type="button" className={mode==='upload'?'active':''} aria-pressed={mode==='upload'} onClick={()=>setMode('upload')}>Upload new photo</button>
   </div>
   {mode==='library'?<div className="ci-photo-library">
    <div className="ci-photo-library-title"><strong>Photos already uploaded to this hotel</strong><button type="button" onClick={()=>void refreshLibrary()} disabled={busy||loadingLibrary}>Refresh library</button></div>
    {loadingLibrary?<p>Loading available photos…</p>:library.length?<div className="ci-photo-library-grid">
     {library.map(asset=><article className="ci-photo-library-item" key={asset.id}>
      {asset.status==='deleting'?<div className="ci-photo-library-pending">Deletion pending</div>:<img src={asset.url} loading="lazy" alt="Previously uploaded hotel room photo"/>}
      <div><small>{asset.assignedCount} room assignment{asset.assignedCount===1?'':'s'}</small>
      <button type="button" disabled={busy||loading||asset.status!=='active'||photos.length>=3||alreadyAssigned.has(asset.id)} onClick={()=>void reuse(asset)}>
       {asset.status==='deleting'?'Deletion pending':alreadyAssigned.has(asset.id)?'Already in this room':photos.length>=3?'Room is full':'Use for this room'}
      </button>
      <button type="button" className="ci-photo-library-delete" disabled={busy||asset.assignedCount>0}
       title={asset.assignedCount>0?'Remove this photo from all room types before permanent deletion':'Permanently delete this image from Cloudflare R2'}
       onClick={()=>void permanentDelete(asset)}>
        {asset.status==='deleting'?'Retry deletion':'Delete permanently'}
      </button>
      {asset.assignedCount>0&&<small>Remove from all {asset.assignedCount} room assignment{asset.assignedCount===1?'':'s'} to enable permanent deletion.</small>}
      </div>
     </article>)}
    </div>:<p className="ci-small">No uploaded room photos are available yet. Upload the first photo and it will appear here for all of this hotel's room types.</p>}
   </div>:<form onSubmit={upload} className="ci-room-photo-form">
    <label>Upload to {selectedRoom?.display_name||'selected room'} (JPG, PNG, WebP — max 5 MB)
     <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" required disabled={busy||loading||photos.length>=3} onChange={e=>setSelected(e.target.files?.[0]||null)}/>
    </label>
    {preview&&<div className="ci-room-photo-selection"><img src={preview} alt="Selected photo preview"/><div><strong>{selected?.name}</strong><p>{((selected?.size||0)/1048576).toFixed(2)} MB</p></div></div>}
    <button type="submit" disabled={busy||loading||!selected||photos.length>=3||selected.size>MAX_BYTES||selected.size===0}>{busy?'Saving photo…':'Upload and save to hotel library'}</button>
   </form>}
   {photos.length>=3&&<p className="ci-small">This room has 3 photos. Remove an assignment to use another photo.</p>}
  </>}
  {error&&<p role="alert" className="ci-error">{error}</p>}
  {notice&&<p role="status" className="ci-notice">{notice}</p>}
 </section>;
}
