import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface D1Statement {
  bind(...values: (string | number | null)[]): D1Statement;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
}
interface D1Database {
  prepare(query: string): D1Statement;
  batch(statements: D1Statement[]): Promise<unknown[]>;
}
const allowedRoomTypes = new Set(['King Non-Smoking', 'King Smoking', 'Queen Non-Smoking', 'No preference']);
const emailPattern = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
const text = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const safe = (value: string) => value.replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c] || c));
const noStore = {'Cache-Control': 'no-store'};
function validDate(s: string) {
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(s)) return false;
  const d = new Date(s+'T12:00:00Z');
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0,10) === s;
}

export async function POST(request: NextRequest) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 12000) return NextResponse.json({error:'Request too large.'}, {status:413});
  let input: Record<string,unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 12000) throw Error('large');
    input = JSON.parse(raw);
    if (!input || Array.isArray(input) || typeof input !== 'object') throw Error('bad');
  } catch { return NextResponse.json({error:'Invalid request.'}, {status:400}); }
  if (text(input.website,100)) return NextResponse.json({error:'Unable to submit request.'}, {status:400});
  const v = {
    checkIn:text(input.checkIn,10), checkOut:text(input.checkOut,10), roomType:text(input.roomType,35),
    rooms:Number(input.rooms), guests:Number(input.guests), firstName:text(input.firstName,70),
    lastName:text(input.lastName,70), phone:text(input.phone,30), email:text(input.email,160),
    notes:text(input.notes,600)
  };
  const today = new Date().toLocaleDateString('en-CA', {timeZone:'America/Chicago'});
  const nights = (Date.parse(v.checkOut+'T12:00:00Z')-Date.parse(v.checkIn+'T12:00:00Z'))/86400000;
  if (!validDate(v.checkIn) || !validDate(v.checkOut) || v.checkIn < today || nights < 1 || nights > 30 ||
      !allowedRoomTypes.has(v.roomType) || !Number.isInteger(v.rooms) || v.rooms < 1 || v.rooms > 4 ||
      !Number.isInteger(v.guests) || v.guests < 1 || v.guests > 8 ||
      !v.firstName || !v.lastName || !emailPattern.test(v.email) || v.phone.replace(/\\D/g,'').length < 10) {
    return NextResponse.json({error:'Check your dates, room selection and contact information.'},{status:400});
  }

  let db: D1Database;
  try {
    const context = getCloudflareContext();
    const env = context.env as typeof context.env & {DB?: D1Database};
    if (!env.DB) throw Error('DB binding not present');
    db = env.DB;
  } catch {
    console.error('Reservation storage unavailable');
    return NextResponse.json({error:'We cannot store requests right now. Please call 713-993-6567.'},{status:503});
  }

  // A browser-generated key allows safe retries after network interruptions.
  const rawKey = request.headers.get('X-Reservation-Request-Key') || '';
  const idempotencyKey = /^[0-9a-f-]{36}$/i.test(rawKey) ? rawKey : null;
  if (idempotencyKey) {
    try {
      const existing = await db.prepare('SELECT public_reference FROM reservations WHERE idempotency_key = ?').bind(idempotencyKey).first<{public_reference:string}>();
      if (existing) return NextResponse.json({reference:existing.public_reference,status:'Request already received — awaiting staff confirmation',notification:'not_verified'}, {status:200,headers:noStore});
    } catch { return NextResponse.json({error:'Unable to check request status. Please call 713-993-6567.'},{status:503}); }
  }

  const id = crypto.randomUUID();
  const reference = 'CI-'+crypto.randomUUID().replace(/-/g,'').slice(0,12).toUpperCase();
  const mailId = crypto.randomUUID();
  try {
    // D1 batch is transactional: the request and pending notification are saved together.
    await db.batch([
      db.prepare(`INSERT INTO reservations
        (id,public_reference,idempotency_key,first_name,last_name,phone_e164,email,room_type_label,
         check_in,check_out,rooms_count,guests_count,special_requests,booking_status,lumen_sync_status)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'request_received','not_started')`)
        .bind(id,reference,idempotencyKey,v.firstName,v.lastName,v.phone,v.email,v.roomType,
              v.checkIn,v.checkOut,v.rooms,v.guests,v.notes || null),
      db.prepare(`INSERT INTO event_outbox
        (id,reservation_id,event_type,delivery_status,dedupe_key)
        VALUES (?,?,'reservation_email','pending',?)`)
        .bind(mailId,id,'reservation_email:'+id),
      db.prepare(`INSERT INTO reservation_audit_log (id,reservation_id,action,actor_type)
        VALUES (?,?,'request_received','guest')`).bind(crypto.randomUUID(),id)
    ]);
  } catch {
    // In a rare race, an identical idempotency key can be inserted by another request.
    if (idempotencyKey) {
      try {
        const existing = await db.prepare('SELECT public_reference FROM reservations WHERE idempotency_key = ?').bind(idempotencyKey).first<{public_reference:string}>();
        if (existing) return NextResponse.json({reference:existing.public_reference,status:'Request already received — awaiting staff confirmation',notification:'not_verified'},{status:200,headers:noStore});
      } catch {}
    }
    console.error('Reservation persistence failed');
    return NextResponse.json({error:'Unable to save your request. Please call 713-993-6567.'},{status:503});
  }

  // Email is best-effort. Database persistence is never rolled back if email is unavailable.
  const key = process.env.RESEND_API_KEY;
  const to = process.env.RESERVATION_NOTIFY_EMAIL;
  const from = process.env.RESERVATION_FROM_EMAIL;
  let notification: 'sent' | 'pending' = 'pending';
  if (key && to && from) {
    const fields = [
      ['Reference',reference],['Arrival',v.checkIn],['Departure',v.checkOut],['Room preference',v.roomType],
      ['Rooms',String(v.rooms)],['Guests',String(v.guests)],['First name',v.firstName],['Last name',v.lastName],
      ['Phone',v.phone],['Email',v.email],['Notes',v.notes||'(none)']
    ];
    const body = '<h2>New Crystal Inn reservation request — not confirmed</h2><p>Check room availability and rate in Lumen. This request is safely saved in D1, but not booked in Lumen.</p><table border="1" cellpadding="8">'+fields.map(([k,value])=>'<tr><th align="left">'+safe(k)+'</th><td>'+safe(value)+'</td></tr>').join('')+'</table>';
    try {
      const result = await fetch('https://api.resend.com/emails', {
        method:'POST',
        headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':reference},
        body:JSON.stringify({from,to:[to],subject:'New stay REQUEST '+reference+' — '+v.checkIn,html:body,reply_to:v.email}),
        signal:AbortSignal.timeout(8000)
      });
      if (result.ok) {
        notification = 'sent';
        try {
          await db.prepare(`UPDATE event_outbox SET delivery_status='delivered',attempts=1,
            last_attempt_at=CURRENT_TIMESTAMP,delivered_at=CURRENT_TIMESTAMP WHERE id=?`).bind(mailId).run();
        } catch { console.error('Request mail sent but delivery-status update failed'); }
      } else {
        console.error('Reservation mail provider failed',result.status);
      }
    } catch { console.error('Reservation notification attempt failed'); }
  }
  return NextResponse.json({
    reference,
    status:'Request received — awaiting staff confirmation',
    notification,
    message:notification === 'pending' ? 'Request saved, but front-desk notification is not confirmed. Please call the hotel to follow up.' : undefined
  },{status:201,headers:noStore});
}
