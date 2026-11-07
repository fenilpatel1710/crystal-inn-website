import {NextRequest,NextResponse} from 'next/server';
import {getCloudflareContext} from '@opennextjs/cloudflare';
import {environment,originValid,noStore} from '../../../../lib/platform/auth';
import {sendGoogleWorkspaceMail} from '../../../../lib/google-workspace-mail';
import {createHash} from 'node:crypto';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const validEmail=(email:string)=>email.length<=190&&/^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/.test(email);
type Hotel={id:string;display_name:string;public_email:string|null};
type Inbox={booking_notification_email:string|null};

export async function POST(req:NextRequest){
 if(!originValid(req))return NextResponse.json({error:'Invalid request origin.'},{status:403,headers:noStore});
 const raw=await req.text();
 if(raw.length>5000)return NextResponse.json({error:'Request too large.'},{status:413,headers:noStore});
 let b:Record<string,unknown>;
 try{
  const value:unknown=JSON.parse(raw);
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid');
  b=value as Record<string,unknown>;
 }catch{return NextResponse.json({error:'Invalid request.'},{status:400,headers:noStore})}
 // Honeypot: do not send or create messages for suspected bot submissions.
 if(String(b.website||''))return NextResponse.json({ok:true},{headers:noStore});
 const hotelId=String(b.hotelId||''),
  name=String(b.name||'').trim(),
  email=String(b.email||'').trim().toLowerCase(),
  phone=String(b.phone||'').trim(),
  subject=String(b.subject||'').trim(),
  message=String(b.message||'').trim();
 if(name.length<2||name.length>100||!validEmail(email)||phone.length>35||
  subject.length<3||subject.length>150||/[\r\n]/.test(subject)||
  message.length<10||message.length>2500||hotelId.length>120)
  return NextResponse.json({error:'Enter your name, email, subject and a message of at least 10 characters.'},
   {status:400,headers:noStore});
 try{
  const e=environment();
  if(!e.db)return NextResponse.json({error:'Contact form unavailable.'},{status:503,headers:noStore});
  const key=createHash('sha256').update((e.secret||'')+':inquiry:'+
   String(req.headers.get('cf-connecting-ip')||'unknown')+':'+email).digest('hex');
  const now=Math.floor(Date.now()/1000);
  const row=await e.db.prepare('SELECT window_start,failed_attempts FROM admin_login_attempts WHERE client_key=?')
   .bind(key).first<{window_start:number;failed_attempts:number}>();
  if(row&&now-row.window_start<3600&&row.failed_attempts>=5)
   return NextResponse.json({error:'Too many messages. Try again later.'},{status:429,headers:noStore});
  const count=row&&now-row.window_start<3600?row.failed_attempts+1:1;
  const windowStart=row&&now-row.window_start<3600?row.window_start:now;

  const hotel=hotelId?await e.db.prepare(
   "SELECT id,display_name,public_email FROM hotels WHERE id=? AND status='active' AND archived_at IS NULL")
   .bind(hotelId).first<Hotel>():null;
  if(hotelId&&!hotel)return NextResponse.json({error:'Selected hotel is not available.'},{status:400,headers:noStore});
  const id=crypto.randomUUID();
  // Saving the contact request is independent of email provider availability.
  // Super Admin → Guest Inquiries is the durable queue for ALL property inquiries.
  await e.db.batch([
   e.db.prepare(`INSERT INTO admin_login_attempts(client_key,window_start,failed_attempts,locked_until)
    VALUES(?,?,?,0) ON CONFLICT(client_key) DO UPDATE SET
    window_start=excluded.window_start,failed_attempts=excluded.failed_attempts,locked_until=0`)
    .bind(key,windowStart,count),
   e.db.prepare(`INSERT INTO guest_inquiries(id,hotel_id,guest_name,email,phone,subject,message)
    VALUES(?,?,?,?,?,?,?)`).bind(id,hotel?.id||null,name,email,phone||null,subject,message)
  ]);

  const setting=await e.db.prepare(
   "SELECT setting_value FROM platform_settings WHERE setting_key='contact_email'")
   .first<{setting_value:string}>().catch(()=>null);
  const centralEmail=(setting?.setting_value||'reservations@crystalinnstay.com').trim();
  const hotelInbox=hotel?await e.db.prepare(
   'SELECT booking_notification_email FROM hotel_reservation_settings WHERE hotel_id=?')
   .bind(hotel.id).first<Inbox>().catch(()=>null):null;
  // For a selected hotel, route to its configured hotel booking inbox, then
  // its public email; otherwise go to the Super Admin central inquiries inbox.
  // If a property has no email, fall back to the central inquiries inbox.
  const recipient=hotel
   ?(hotelInbox?.booking_notification_email||hotel.public_email||centralEmail).trim()
   :centralEmail;
  let notification:'sent'|'pending'='pending';
  if(validEmail(recipient)){
   const text=[
    'New Crystal Inn guest inquiry',
    'Reference: '+id,
    'Hotel: '+(hotel?.display_name||'General / Crystal Inn network'),
    'Guest: '+name,
    'Guest email: '+email,
    'Phone: '+(phone||'Not provided'),
    'Subject: '+subject,
    '',
    message,
    '',
    'This inquiry is also stored under Super Admin → Guest Inquiries.'
   ].join('\n');
   try{
    const env=getCloudflareContext().env as unknown as Record<string,unknown>;
    const result=await sendGoogleWorkspaceMail(env,{
     to:recipient,subject:'Crystal Inn inquiry: '+subject,text,replyTo:email
    });
    if(result.accepted)notification='sent';
    // Gmail acceptance does not guarantee inbox delivery. Unknown outcomes
    // must be reconciled in the sender's Sent folder before manual resend.
   }catch{}
  }
  return NextResponse.json({ok:true,id,notification},{status:201,headers:noStore});
 }catch{
  return NextResponse.json({error:'Unable to save your inquiry.'},{status:503,headers:noStore});
 }
}
