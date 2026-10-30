'use client';
import {useEffect,useState,FormEvent} from 'react';
import './portal.css';
type Hotel={id:string;slug:string;display_name:string;city:string;region:string;status:string;manager_count:number};
type Manager={id:string;email:string;status:string;hotel_id:string;hotel_name:string;role:string};
export default function PlatformAdmin(){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[ready,setReady]=useState(false);
 const [hotels,setHotels]=useState<Hotel[]>([]),[managers,setManagers]=useState<Manager[]>([]),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [name,setName]=useState(''),[city,setCity]=useState(''),[region,setRegion]=useState('TX'),[slug,setSlug]=useState('');
 const [hotelId,setHotelId]=useState(''),[managerEmail,setManagerEmail]=useState(''),[managerPassword,setManagerPassword]=useState('');
 async function request(url:string,init?:RequestInit){
  const r=await fetch(url,{...init,cache:'no-store'});const d=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(d.error||'Request failed');return d;
 }
 async function refresh(){try{const [h,m]=await Promise.all([request('/api/platform/hotels'),request('/api/platform/managers')]);setHotels(h.hotels);setManagers(m.managers);setReady(true);}catch{setReady(false)}}
 useEffect(()=>{void refresh()},[]);
 async function login(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{await request('/api/platform/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});setPassword('');await refresh()}catch(e){setError(e instanceof Error?e.message:'Sign-in failed')}finally{setBusy(false)}}
 async function addHotel(e:FormEvent){e.preventDefault();setBusy(true);setError('');setNotice('');try{await request('/api/platform/hotels',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,slug,city,region})});setName('');setSlug('');setCity('');setNotice('Hotel created in draft mode. Configure its rooms and staff before activation.');await refresh()}catch(e){setError(e instanceof Error?e.message:'Failed')}finally{setBusy(false)}}
 async function addManager(e:FormEvent){e.preventDefault();setBusy(true);setError('');setNotice('');try{await request('/api/platform/managers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({hotelId,email:managerEmail,password:managerPassword})});setManagerEmail('');setManagerPassword('');setNotice('Manager created. Share credentials through a secure channel. Hotel must be active before sign-in.');await refresh()}catch(e){setError(e instanceof Error?e.message:'Failed')}finally{setBusy(false)}}
 async function changeManager(id:string,action:'suspend'|'activate'|'reset_password'){
 const manager=managers.find(m=>m.id===id);
 if(!manager)return;
 let password='';
 if(action==='reset_password'){const proposed=window.prompt('Enter a new unique manager password (at least 16 characters). Do not reuse a password.');if(proposed===null)return;password=proposed;if(password.length<16){setError('Password must be at least 16 characters.');return}}
 else if(!window.confirm((action==='suspend'?'Suspend':'Reactivate')+' '+manager.email+'?'))return;
 setBusy(true);setError('');setNotice('');
 try{await request('/api/platform/access',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({managerId:id,action,password})});setNotice('Manager access updated.');await refresh()}
 catch(e){setError(e instanceof Error?e.message:'Unable to update access')}
 finally{setBusy(false)}
 }
 async function setStatus(id:string,status:'active'|'suspended'|'draft'){
 if(!window.confirm('Change hotel status to '+status+'?'))return;
 setBusy(true);setError('');setNotice('');
 try{await request('/api/platform/hotels/status',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({hotelId:id,status})});
 setNotice('Hotel status changed to '+status+'.');await refresh();}
 catch(e){setError(e instanceof Error?e.message:'Unable to change status')}
 finally{setBusy(false)}
 }
 async function logout(){await request('/api/platform/logout',{method:'POST'}).catch(()=>{});setReady(false);setHotels([]);setManagers([])}
 return <main className="ci-console"><header><a href="/">CRYSTAL INN</a><span>PLATFORM CONTROL CENTER</span>{ready&&<button onClick={()=>void logout()}>Sign out</button>}</header>
 {!ready?<div className="ci-auth"><p className="ci-kicker">CENTRAL MANAGEMENT</p><h1>Super Admin</h1><p>Only the platform operator can onboard hotels and manage property administrators.</p><form onSubmit={login}><label>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username"/></label><label>Password<input type="password" required value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/></label><button disabled={busy}>Sign in</button></form>{error&&<p role="alert" className="ci-error">{error}</p>}</div>:
 <div className="ci-console-body"><p className="ci-kicker">HOTEL NETWORK</p><h1>Crystal Inn properties</h1><p>Manage participating hotels and the individual administrators assigned to them.</p>{error&&<p role="alert" className="ci-error">{error}</p>}{notice&&<p role="status" className="ci-notice">{notice}</p>}
 <div className="ci-summary"><article><strong>{hotels.length}</strong>Hotels registered</article><article><strong>{hotels.filter(h=>h.status==='active').length}</strong>Active hotels</article><article><strong>{managers.length}</strong>Manager assignments</article></div>
 <section className="ci-panel"><h2>Hotel directory</h2><div className="ci-table"><table><thead><tr><th>Hotel</th><th>Location</th><th>Page</th><th>Status</th><th>Managers</th><th>Manage</th></tr></thead><tbody>{hotels.map(h=><tr key={h.id}><td><b>{h.display_name}</b></td><td>{h.city}, {h.region}</td><td>/hotels/{h.slug}</td><td>{h.status}</td><td>{h.manager_count}</td><td>{h.status==='active'?<button disabled={busy} onClick={()=>void setStatus(h.id,'suspended')}>Suspend</button>:<button disabled={busy} onClick={()=>void setStatus(h.id,'active')}>Activate</button>}</td></tr>)}</tbody></table></div></section>
 <div className="ci-two"><section className="ci-panel"><h2>Add hotel</h2><p>New hotels start as drafts, with no guest bookings enabled.</p><form onSubmit={addHotel}><label>Hotel name<input required value={name} onChange={e=>setName(e.target.value)} placeholder="Crystal Inn – Location"/></label><label>City<input required value={city} onChange={e=>setCity(e.target.value)}/></label><label>State abbreviation<input required maxLength={2} value={region} onChange={e=>setRegion(e.target.value)}/></label><label>Website slug<input required value={slug} onChange={e=>setSlug(e.target.value)} placeholder="location-name"/></label><button disabled={busy}>Create draft hotel</button></form></section>
 <section className="ci-panel"><h2>Add hotel administrator</h2><p>Give each manager their own credentials and property assignment.</p><form onSubmit={addManager}><label>Hotel<select required value={hotelId} onChange={e=>setHotelId(e.target.value)}><option value="">Select a hotel</option>{hotels.map(h=><option key={h.id} value={h.id}>{h.display_name}</option>)}</select></label><label>Manager email<input type="email" required value={managerEmail} onChange={e=>setManagerEmail(e.target.value)}/></label><label>Initial password (16+ characters)<input type="password" required minLength={16} maxLength={128} value={managerPassword} onChange={e=>setManagerPassword(e.target.value)}/></label><button disabled={busy}>Create manager</button></form><p className="ci-small">Use a unique temporary password. Self-service password changes and recovery have not yet been added.</p></section></div>
 <section className="ci-panel"><h2>Hotel manager access</h2><div className="ci-table"><table><thead><tr><th>Manager</th><th>Hotel</th><th>Role</th><th>Status</th><th>Access</th></tr></thead><tbody>{managers.map(m=><tr key={m.id}><td>{m.email}</td><td>{m.hotel_name}</td><td>{m.role}</td><td>{m.status}</td><td><button disabled={busy} onClick={()=>void changeManager(m.id,'reset_password')}>Reset password</button>{m.status==='active'?<button disabled={busy} onClick={()=>void changeManager(m.id,'suspend')}>Suspend</button>:<button disabled={busy} onClick={()=>void changeManager(m.id,'activate')}>Activate</button>}</td></tr>)}</tbody></table></div></section>
 </div>}</main>
}