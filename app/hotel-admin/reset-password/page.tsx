'use client';
import {useState,FormEvent,useEffect} from 'react';
export default function ResetPassword(){
 const [token,setToken]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[error,setError]=useState(''),[done,setDone]=useState(false),[busy,setBusy]=useState(false);
 useEffect(()=>{setToken(new URLSearchParams(window.location.search).get('token')||'')},[]);
 async function submit(e:FormEvent){e.preventDefault();setError('');if(password!==confirm){setError('Passwords do not match.');return}setBusy(true);
 try{const r=await fetch('/api/hotel/reset-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,password})});const d=await r.json();if(!r.ok)throw Error(d.error||'Reset failed');setDone(true);setPassword('');setConfirm('')}
 catch(e){setError(e instanceof Error?e.message:'Reset failed')}finally{setBusy(false)}
 }
 return <main style={{fontFamily:'Arial,sans-serif',maxWidth:480,margin:'8vh auto',padding:28,color:'#123c64'}}><a href="/hotel-admin">Crystal Inn Hotel Admin</a><h1>Reset your password</h1>{done?<><p>Password updated. Return to Hotel Admin to sign in.</p><a href="/hotel-admin">Sign in</a></>:<><p>Use the one-time reset link sent to your email. It expires after 30 minutes.</p><form onSubmit={submit}><label>New password (16+ characters)<input type="password" autoComplete="new-password" required minLength={16} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} style={{display:'block',width:'100%',padding:12,margin:'9px 0 20px'}}/></label><label>Confirm new password<input type="password" autoComplete="new-password" required minLength={16} maxLength={128} value={confirm} onChange={e=>setConfirm(e.target.value)} style={{display:'block',width:'100%',padding:12,margin:'9px 0 20px'}}/></label><button disabled={busy||!token} style={{padding:14,background:'#184aaf',color:'white',border:0,borderRadius:5}}>Update password</button></form>{error&&<p role="alert">{error}</p>}</>}</main>
}
