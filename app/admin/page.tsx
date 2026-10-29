'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import styles from './admin.module.css';

type Reservation={
 public_reference:string;first_name:string;last_name:string;phone_e164:string;email:string;
 room_type_label:string;check_in:string;check_out:string;rooms_count:number;guests_count:number;
 booking_status:string;lumen_sync_status:string;special_requests:string|null;created_at:string
};
type Room={id:string;display_name:string;is_active:number};
type Night={room_type_id:string;stay_date:string;allotment:number;rate_cents:number|null;stop_sell:number};
const roomNames=['King Non-Smoking','King Smoking','Queen Non-Smoking'];
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Chicago'});
export default function AdminPage(){
 const [tab,setTab]=useState<'reservations'|'inventory'>('reservations');
 const [reservations,setReservations]=useState<Reservation[]>([]);
 const [rooms,setRooms]=useState<Room[]>([]);
 const [inventory,setInventory]=useState<Night[]>([]);
 const [from,setFrom]=useState(today());
 const [date,setDate]=useState(today());
 const [roomId,setRoomId]=useState(roomNames[0]);
 const [rate,setRate]=useState('');
 const [allotment,setAllotment]=useState('0');
 const [stopSell,setStopSell]=useState(false);
 const [filter,setFilter]=useState('all');
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const fetchJson=useCallback(async(url:string,init?:RequestInit)=>{
  const response=await fetch(url,{...init,cache:'no-store'});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||'Unable to load. Check Cloudflare Access login settings.');
  return data;
 },[]);
 const reload=useCallback(async()=>{
   setLoading(true);setError('');
   try{
     const [r,i]=await Promise.all([
       fetchJson('/api/admin/reservations'),
       fetchJson('/api/admin/inventory?from='+encodeURIComponent(from))
     ]);
     setReservations(r.reservations||[]);setRooms(i.rooms||[]);setInventory(i.inventory||[]);
   }catch(err){setError(err instanceof Error?err.message:'Unable to open admin data.');}
   finally{setLoading(false);}
 },[fetchJson,from]);
 useEffect(()=>{void reload();},[reload]);
 const selected=useMemo(()=>inventory.find(x=>x.room_type_id===roomId&&x.stay_date===date),[inventory,roomId,date]);
 useEffect(()=>{
   setRate(selected?.rate_cents==null?'':(selected.rate_cents/100).toFixed(2));
   setAllotment(String(selected?.allotment??0));setStopSell(Boolean(selected?.stop_sell));
 },[selected]);
 const visible=filter==='all'?reservations:reservations.filter(r=>r.booking_status===filter);
 const requests=reservations.filter(r=>r.booking_status==='request_received').length;
 async function addRoom(name:string){
   setSaving(true);setError('');setNotice('');
   try{await fetchJson('/api/admin/inventory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});setNotice(name+' added.');await reload();}
   catch(err){setError(err instanceof Error?err.message:'Save failed.');}
   finally{setSaving(false);}
 }
 async function save(){
   const qty=Number(allotment);
   if(!Number.isInteger(qty)||qty<0||qty>57){setError('Room availability must be a whole number from 0 to 57.');return;}
   if(!date){setError('Choose a date.');return;}
   if(rate!==''&&(!/^\d+(\.\d{1,2})?$/.test(rate)||Number(rate)>10000)){setError('Enter a valid nightly price (up to $10,000).');return;}
   setSaving(true);setError('');setNotice('');
   try{
    await fetchJson('/api/admin/inventory',{method:'PUT',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({roomTypeId:roomId,stayDate:date,allotment:qty,
       rateCents:rate===''?null:Math.round(Number(rate)*100),stopSell})});
    setNotice('Nightly settings saved for '+date+'.');await reload();
   }catch(err){setError(err instanceof Error?err.message:'Save failed.');}
   finally{setSaving(false);}
 }
 return <main className={styles.page}>
  <header className={styles.header}><div><a className={styles.brand} href="/">CRYSTAL INN <span>STAFF CONSOLE</span></a><p>Northwest 290 · Houston</p></div><div className={styles.user}>Admin: crystalinngessner@gmail.com</div></header>
  <div className={styles.wrap}>
    <div className={styles.heading}><div><p className={styles.eyebrow}>OPERATIONS DASHBOARD</p><h1>Property management</h1><p>Manage reservation requests, room allotments and nightly rates.</p></div><button className={styles.secondary} onClick={()=>void reload()} disabled={loading}>Refresh data</button></div>
    <div className={styles.metrics}>
      <div><span>Total requests / records</span><strong>{reservations.length}</strong></div>
      <div><span>Awaiting review</span><strong>{requests}</strong></div>
      <div><span>Room types configured</span><strong>{rooms.length}</strong></div>
    </div>
    <nav className={styles.tabs}><button aria-current={tab==='reservations'?'page':undefined} onClick={()=>setTab('reservations')}>Reservations</button><button aria-current={tab==='inventory'?'page':undefined} onClick={()=>setTab('inventory')}>Rates & availability</button></nav>
    {error&&<div role="alert" className={styles.error}>{error}<p>If access isn't configured yet, the administrator must enable Cloudflare Access for this page and its APIs.</p></div>}
    {notice&&<div role="status" className={styles.notice}>{notice}</div>}
    {tab==='reservations'?<section className={styles.panel}>
      <div className={styles.toolbar}><h2>Reservation requests</h2><label>Filter <select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All statuses</option><option value="request_received">Request received</option><option value="pending_review">Pending review</option><option value="confirmed">Confirmed</option><option value="cancelled">Cancelled</option><option value="rejected">Rejected</option></select></label></div>
      <div className={styles.note}>These records are website requests. They are not automatically confirmed or synchronized with Lumen. Verify details and availability with the front desk.</div>
      {loading?<p>Loading reservation data…</p>:visible.length===0?<p>No reservation records found for this filter.</p>:
      <div className={styles.tableWrap}><table><thead><tr><th>Reference / guest</th><th>Contact</th><th>Stay</th><th>Room</th><th>Status</th><th>Notes</th></tr></thead><tbody>
      {visible.map(r=><tr key={r.public_reference}><td><strong>{r.public_reference}</strong><small>{r.first_name} {r.last_name}</small></td><td><a href={'tel:'+r.phone_e164}>{r.phone_e164}</a><small>{r.email}</small></td><td>{r.check_in} → {r.check_out}<small>{r.guests_count} guests · {r.rooms_count} rooms</small></td><td>{r.room_type_label}</td><td><span className={styles.status}>{r.booking_status.replaceAll('_',' ')}</span><small>Lumen: {r.lumen_sync_status}</small></td><td>{r.special_requests||'—'}</td></tr>)}
      </tbody></table></div>}
      <p className={styles.small}>Shows the newest 200 reservation records. This screen does not change booking statuses or send guest confirmations.</p>
    </section>:<section className={styles.panel}>
      <h2>Room rates & nightly availability</h2>
      <p className={styles.small}>Values are planning allotments for the website only. Editing these does not update Lumen or activate automatic room confirmation.</p>
      <h3>Room categories</h3>
      <div className={styles.roomChips}>{roomNames.map(name=><button className={styles.secondary} key={name} disabled={saving||rooms.some(r=>r.id===name)} onClick={()=>void addRoom(name)}>{rooms.some(r=>r.id===name)?'✓ '+name:'+ Add '+name}</button>)}</div>
      <div className={styles.form}>
        <label>Room type<select value={roomId} onChange={e=>setRoomId(e.target.value)}>{roomNames.map(n=><option key={n}>{n}</option>)}</select></label>
        <label>Stay night<input type="date" value={date} min={today()} onChange={e=>setDate(e.target.value)}/></label>
        <label>Rooms allotted online<input inputMode="numeric" type="number" min="0" max="57" step="1" value={allotment} onChange={e=>setAllotment(e.target.value)}/></label>
        <label>Nightly rate ($ USD)<input type="number" min="0" max="10000" step="0.01" placeholder="Not set" value={rate} onChange={e=>setRate(e.target.value)}/></label>
        <label className={styles.check}><input type="checkbox" checked={stopSell} onChange={e=>setStopSell(e.target.checked)}/>Stop selling this room type on this date</label>
        <button className={styles.primary} disabled={saving||!rooms.some(r=>r.id===roomId)} onClick={()=>void save()}>{saving?'Saving…':'Save nightly settings'}</button>
      </div>
      <div className={styles.toolbar}><h3>Configured nights</h3><label>Starting date <input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label></div>
      {inventory.length===0?<p>No nightly inventory configured for this 31-day window.</p>:<div className={styles.tableWrap}><table><thead><tr><th>Date</th><th>Room type</th><th>Online allotment</th><th>Nightly rate</th><th>Stop sell</th></tr></thead><tbody>{inventory.map(r=><tr key={r.room_type_id+r.stay_date}><td>{r.stay_date}</td><td>{r.room_type_id}</td><td>{r.allotment}</td><td>{r.rate_cents===null?'Not set':'$'+(r.rate_cents/100).toFixed(2)}</td><td>{r.stop_sell?'Yes':'No'}</td></tr>)}</tbody></table></div>}
    </section>}
  </div>
 </main>;
}
