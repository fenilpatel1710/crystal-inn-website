import {NextRequest,NextResponse} from 'next/server';
import {environment,originValid,noStore} from '../../../../lib/platform/auth';
import {createHash} from 'node:crypto';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(req:NextRequest){
 if(!originValid(req))return NextResponse.json({error:'Invalid request origin.'},{status:403,headers:noStore});
 const raw=await req.text();if(raw.length>5000)return NextResponse.json({error:'Request too large.'},{status:413,headers:noStore});
 let b:Record<string,unknown>;try{const value:unknown=JSON.parse(raw);if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid');b=value as Record<string,unknown>}catch{return NextResponse.json({error:'Invalid request.'},{status:400,headers:noStore})}
 if(String(b.website||''))return NextResponse.json({ok:true},{headers:noStore});
 const hotelId=String(b.hotelId||''),name=String(b.name||'').trim(),email=String(b.email||'').trim().toLowerCase(),
 phone=String(b.phone||'').trim(),subject=String(b.subject||'').trim(),message=String(b.message||'').trim();
 if(name.length<2||name.length>100||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>190||phone.length>35||
 subject.length<3||subject.length>150||message.length<10||message.length>2500||hotelId.length>120)
 return NextResponse.json({error:'Enter your name, email, subject and a message of at least 10 characters.'},{status:400,headers:noStore});
 try{
 const e=environment();if(!e.db)return NextResponse.json({error:'Contact form unavailable.'},{status:503,headers:noStore});
 const key=createHash('sha256').update((e.secret||'')+':inquiry:'+String(req.headers.get('cf-connecting-ip')||'unknown')+':'+email).digest('hex');
 const now=Math.floor(Date.now()/1000);
 const row=await e.db.prepare('SELECT window_start,failed_attempts FROM admin_login_attempts WHERE client_key=?').bind(key).first<{window_start:number;failed_attempts:number}>();
 if(row&&now-row.window_start<3600&&row.failed_attempts>=5)return NextResponse.json({error:'Too many messages. Try again later.'},{status:429,headers:noStore});
 const count=row&&now-row.window_start<3600?row.failed_attempts+1:1,windowStart=row&&now-row.window_start<3600?row.window_start:now;
 const hotel=hotelId?await e.db.prepare("SELECT id FROM hotels WHERE id=? AND status='active' AND archived_at IS NULL").bind(hotelId).first<{id:string}>():null;
 if(hotelId&&!hotel)return NextResponse.json({error:'Selected hotel is not available.'},{status:400,headers:noStore});
 const id=crypto.randomUUID();
 await e.db.batch([
 e.db.prepare(`INSERT INTO admin_login_attempts(client_key,window_start,failed_attempts,locked_until) VALUES(?,?,?,0)
 ON CONFLICT(client_key) DO UPDATE SET window_start=excluded.window_start,failed_attempts=excluded.failed_attempts,locked_until=0`).bind(key,windowStart,count),
 e.db.prepare('INSERT INTO guest_inquiries(id,hotel_id,guest_name,email,phone,subject,message) VALUES(?,?,?,?,?,?,?)')
 .bind(id,hotel?.id||null,name,email,phone||null,subject,message)
 ]);
 const settings=await e.db.prepare("SELECT setting_value FROM platform_settings WHERE setting_key='contact_email'").first<{setting_value:string}>().catch(()=>null);
 const to=settings?.setting_value||'frontdesk@crystalinnstay.com';
 let notification:'sent'|'pending'='pending';
 const keyMail=process.env.RESEND_API_KEY,from=process.env.RESERVATION_FROM_EMAIL;
 if(keyMail&&from){
 try{
 const mail=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+keyMail,'Content-Type':'application/json'},
 body:JSON.stringify({from,to:[to],subject:'Crystal Inn inquiry: '+subject,reply_to:email,
 text:'New inquiry ID: '+id+'\nHotel ID: '+(hotel?.id||'General')+'\nGuest: '+name+'\nEmail: '+email+'\nPhone: '+phone+'\nSubject: '+subject+'\n\n'+message})});
 if(mail.ok)notification='sent';
 }catch{}
 }
 return NextResponse.json({ok:true,id,notification},{status:201,headers:noStore});
 }catch{return NextResponse.json({error:'Unable to save your inquiry.'},{status:503,headers:noStore})}
}
