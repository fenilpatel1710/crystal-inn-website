'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';

type Photo={id:string;caption:string;url:string};
type Gallery={activeId:string|null;photos:Photo[]};
export default function HomepageMediaManager(){
 const [gallery,setGallery]=useState<Gallery>({activeId:null,photos:[]});
 const [file,setFile]=useState<File|null>(null),[preview,setPreview]=useState('');
 const [caption,setCaption]=useState('Crystal Inn Hotels & Stays');
 const [drafts,setDrafts]=useState<Record<string,string>>({});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const input=useRef<HTMLInputElement>(null);
 useEffect(()=>{let active=true;
  fetch('/api/platform/homepage-media',{cache:'no-store'}).then(async r=>{
   const data=await r.json();if(!r.ok)throw Error(data.error||'Could not load homepage photos.');
   if(active){setGallery({activeId:data.activeId,photos:data.photos});setDrafts(Object.fromEntries(data.photos.map((p:Photo)=>[p.id,p.caption])));}
  }).catch(e=>{if(active)setError(e instanceof Error?e.message:'Homepage photos unavailable.')});
  return()=>{active=false};
 },[]);
 useEffect(()=>{if(!file){setPreview('');return}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url)},[file]);
 async function request(url:string,method:string,body:BodyInit,contentType?:string){
  const response=await fetch(url,{method,headers:contentType?{'Content-Type':contentType}:undefined,body,cache:'no-store'});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||'Unable to save changes.');
  setGallery({activeId:data.activeId,photos:data.photos});
  setDrafts(Object.fromEntries((data.photos as Photo[]).map(p=>[p.id,p.caption])));
 }
 async function upload(e:FormEvent){
  e.preventDefault();if(!file)return;
  if(file.size>5*1024*1024){setError('Choose a photo smaller than 5 MB.');return}
  setBusy(true);setError('');setNotice('');
  try{
   const form=new FormData();form.append('photo',file);form.append('caption',caption.trim());
   await request('/api/platform/homepage-media','POST',form);
   setFile(null);if(input.current)input.current.value='';
   setNotice('Homepage photo added and selected. The public website will display it on the next refresh.');
  }catch(ex){setError(ex instanceof Error?ex.message:'Upload failed.')}
  finally{setBusy(false)}
 }
 async function update(id:string,action:'activate'|'caption'){
  setBusy(true);setError('');setNotice('');
  try{
   await request('/api/platform/homepage-media','PUT',JSON.stringify({id,action,caption:drafts[id]||''}),'application/json');
   setNotice(action==='activate'?'Selected the homepage lead image.':'Photo caption updated.');
  }catch(ex){setError(ex instanceof Error?ex.message:'Unable to save changes.')}
  finally{setBusy(false)}
 }
 async function remove(id:string){
  if(!window.confirm('Remove this photo from the homepage gallery?'))return;
  setBusy(true);setError('');setNotice('');
  try{
   await request('/api/platform/homepage-media','DELETE',JSON.stringify({id}),'application/json');
   setNotice('Photo removed from the homepage gallery.');
  }catch(ex){setError(ex instanceof Error?ex.message:'Unable to remove photo.')}
  finally{setBusy(false)}
 }
 return <section className="ci-panel ci-homepage-media-manager">
  <h2>Homepage welcome photos</h2>
  <p>Manage the large photo beside the <strong>Welcome to Houston</strong> stamp on the main Crystal Inn homepage. Add up to 8 real hotel images, select which one appears first, and edit the captions. Guests can browse the other photos with arrows.</p>
  {error&&<p className="ci-error" role="alert">{error}</p>}
  {notice&&<p className="ci-notice" role="status">{notice}</p>}
  <form onSubmit={upload} className="ci-homepage-upload">
   <label>Add a new homepage photo (JPG, PNG or WebP, 5 MB maximum)
    <input ref={input} type="file" required accept="image/jpeg,image/png,image/webp" onChange={e=>setFile(e.target.files?.[0]||null)}/>
   </label>
   <label>Photo caption
    <input maxLength={90} value={caption} onChange={e=>setCaption(e.target.value)} placeholder="e.g. Welcome to Crystal Inn Northwest 290"/>
   </label>
   {preview&&<img className="ci-homepage-upload-preview" src={preview} alt="Selected image preview"/>}
   <button disabled={busy||!file||file.size>5*1024*1024||gallery.photos.length>=8}>{busy?'Saving…':'Upload and use on homepage'}</button>
  </form>
  <p className="ci-small">This photo library is separate from each hotel's own room and property photos. The hotel administrator's gallery is not modified.</p>
  <h3>Homepage gallery ({gallery.photos.length} of 8)</h3>
  {!gallery.photos.length&&<p className="ci-notice">No custom homepage images yet. The website continues to show its existing Crystal Inn exterior photo.</p>}
  <div className="ci-homepage-photo-grid">
   {gallery.photos.map((photo,index)=><article key={photo.id} className={'ci-homepage-photo-card'+(gallery.activeId===photo.id?' is-active':'')}>
    <img src={photo.url} alt={photo.caption||'Crystal Inn homepage photo'} loading="lazy"/>
    <div className="ci-homepage-photo-info">
     <span className="ci-small">{gallery.activeId===photo.id?'★ Main photo':'Gallery photo '+(index+1)}</span>
     <label>Caption <input maxLength={90} value={drafts[photo.id]??photo.caption} onChange={e=>setDrafts(prev=>({...prev,[photo.id]:e.target.value}))}/></label>
     <div className="ci-homepage-photo-actions">
      {gallery.activeId!==photo.id&&<button disabled={busy} type="button" onClick={()=>void update(photo.id,'activate')}>Set as main</button>}
      <button disabled={busy||drafts[photo.id]===photo.caption} type="button" onClick={()=>void update(photo.id,'caption')}>Save caption</button>
      <button disabled={busy} className="ci-danger-action" type="button" onClick={()=>void remove(photo.id)}>Remove</button>
     </div>
    </div>
   </article>)}
  </div>
 </section>;
}
