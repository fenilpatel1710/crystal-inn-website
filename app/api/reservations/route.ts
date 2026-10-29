import {NextRequest,NextResponse} from 'next/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';

const allowedRoomTypes=new Set(['King Non-Smoking','King Smoking','Queen Non-Smoking','No preference']);
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text=(v:unknown,max:number)=>typeof v==='string'?v.trim().slice(0,max):'';
const safe=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
function validDate(s:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T12:00:00Z');return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===s}
export async function POST(request:NextRequest){
 // Accept requests only when a verified operational inbox is configured.
 const key=process.env.RESEND_API_KEY;
 const to=process.env.RESERVATION_NOTIFY_EMAIL;
 const from=process.env.RESERVATION_FROM_EMAIL;
 if(!key||!to||!from)return NextResponse.json({error:'Online requests are being configured. Please call the hotel at 713-993-6567.'},{status:503});
 const length=Number(request.headers.get('content-length')||0);
 if(length>12000)return NextResponse.json({error:'Request too large.'},{status:413});
 let input:Record<string,unknown>;
 try{const raw=await request.text();if(raw.length>12000)throw Error('large');input=JSON.parse(raw);if(!input||Array.isArray(input)||typeof input!=='object')throw Error('bad');}
 catch{return NextResponse.json({error:'Invalid request.'},{status:400})}
 if(text(input.website,100))return NextResponse.json({error:'Unable to submit request.'},{status:400});
 const v={
  checkIn:text(input.checkIn,10),checkOut:text(input.checkOut,10),roomType:text(input.roomType,35),
  rooms:Number(input.rooms),guests:Number(input.guests),firstName:text(input.firstName,70),
  lastName:text(input.lastName,70),phone:text(input.phone,30),email:text(input.email,160),
  notes:text(input.notes,600)
 };
 // Dates are calendar dates, not UTC midnight instants.
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Chicago'});
 const stayNights=(Date.parse(v.checkOut+'T12:00:00Z')-Date.parse(v.checkIn+'T12:00:00Z'))/86400000;
 if(!validDate(v.checkIn)||!validDate(v.checkOut)||v.checkIn<today||stayNights<1||stayNights>30||
 !allowedRoomTypes.has(v.roomType)||!Number.isInteger(v.rooms)||v.rooms<1||v.rooms>4||
 !Number.isInteger(v.guests)||v.guests<1||v.guests>8||
 !v.firstName||!v.lastName||!emailPattern.test(v.email)||v.phone.replace(/\D/g,'').length<10){
   return NextResponse.json({error:'Check your dates, room selection and contact information.'},{status:400});
 }
 const reference='CI-'+crypto.randomUUID().slice(0,8).toUpperCase();
 const fields=[
  ['Reference',reference],['Arrival',v.checkIn],['Departure',v.checkOut],['Room preference',v.roomType],
  ['Rooms',String(v.rooms)],['Guests',String(v.guests)],['First name',v.firstName],['Last name',v.lastName],
  ['Phone',v.phone],['Email',v.email],['Notes',v.notes||'(none)']
 ];
 const body='<h2>New Crystal Inn reservation request — not confirmed</h2><p>Front desk: verify room availability and rate in Lumen, then contact the guest. This email does not create a Lumen booking.</p><table border="1" cellpadding="8">'+fields.map(([k,val])=>'<tr><th align="left">'+safe(k)+'</th><td>'+safe(val)+'</td></tr>').join('')+'</table>';
 try{
  const result=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':reference},body:JSON.stringify({from,to:[to],subject:'New stay REQUEST '+reference+' — '+v.checkIn,html:body,reply_to:v.email}),signal:AbortSignal.timeout(8000)});
  if(!result.ok){console.error('Reservation notification provider returned',result.status);return NextResponse.json({error:'We could not deliver your request. Please call the hotel directly.'},{status:503});}
 }catch{console.error('Reservation notification failed');return NextResponse.json({error:'We could not deliver your request. Please call the hotel directly.'},{status:503});}
 return NextResponse.json({reference,status:'Request received — awaiting staff confirmation'},{status:201,headers:{'Cache-Control':'no-store'}});
}
