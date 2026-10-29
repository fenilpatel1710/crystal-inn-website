import {NextRequest,NextResponse} from 'next/server';
import {requireAdmin,protectedHeaders} from '../../../../lib/admin/auth';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const names=['King Non-Smoking','King Smoking','Queen Non-Smoking'];
function dateOk(s:unknown){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T12:00:00Z');return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===s}
export async function GET(req:NextRequest){
 const auth=await requireAdmin(req);if(auth instanceof NextResponse)return auth;
 const from=new URL(req.url).searchParams.get('from')||new Date().toISOString().slice(0,10);
 if(!dateOk(from))return NextResponse.json({error:'Invalid date'},{status:400});
 const end=new Date(Date.parse(from+'T12:00:00Z')+31*86400000).toISOString().slice(0,10);
 try{
  const rooms=await auth.db.prepare('SELECT id,display_name,is_active FROM room_types ORDER BY display_name').all();
  const rows=await auth.db.prepare(`SELECT room_type_id,stay_date,allotment,stop_sell,rate_cents
    FROM nightly_inventory WHERE stay_date>=? AND stay_date<? ORDER BY stay_date`).bind(from,end).all();
  return NextResponse.json({rooms:rooms.results,inventory:rows.results,from},{headers:protectedHeaders});
 }catch{return NextResponse.json({error:'Inventory unavailable.'},{status:503,headers:protectedHeaders});}
}
export async function POST(req:NextRequest){
 const auth=await requireAdmin(req);if(auth instanceof NextResponse)return auth;
 let input:Record<string,unknown>;
 try{input=await req.json();if(!input||typeof input!=='object'||Array.isArray(input))throw Error();}
 catch{return NextResponse.json({error:'Invalid input.'},{status:400})}
 const name=input.name;
 if(typeof name!=='string'||!names.includes(name))return NextResponse.json({error:'Room type not supported.'},{status:400});
 try{
  await auth.db.prepare(`INSERT INTO room_types(id,display_name) VALUES (?,?)
   ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name,updated_at=CURRENT_TIMESTAMP`)
    .bind(name,name).run();
  return NextResponse.json({ok:true},{headers:protectedHeaders});
 }catch{return NextResponse.json({error:'Unable to add room type.'},{status:503,headers:protectedHeaders});}
}
export async function PUT(req:NextRequest){
 const auth=await requireAdmin(req);if(auth instanceof NextResponse)return auth;
 let body:Record<string,unknown>;
 try{body=await req.json();if(!body||Array.isArray(body)||typeof body!=='object')throw Error();}
 catch{return NextResponse.json({error:'Invalid input'},{status:400})}
 const {roomTypeId,stayDate,allotment,rateCents,stopSell}=body;
 if(typeof roomTypeId!=='string'||!names.includes(roomTypeId)||!dateOk(stayDate)||
    typeof allotment!=='number'||!Number.isInteger(allotment)||allotment<0||allotment>57||
    (rateCents!==null&&(typeof rateCents!=='number'||!Number.isInteger(rateCents)||rateCents<0||rateCents>1000000))||
    typeof stopSell!=='boolean')
  return NextResponse.json({error:'Invalid room availability, price or date.'},{status:400});
 try{
  const exists=await auth.db.prepare('SELECT id FROM room_types WHERE id=? AND is_active=1').bind(roomTypeId).first();
  if(!exists)return NextResponse.json({error:'Add this room type first.'},{status:400});
  await auth.db.prepare(`INSERT INTO nightly_inventory(room_type_id,stay_date,allotment,rate_cents,stop_sell)
     VALUES (?,?,?,?,?) ON CONFLICT(room_type_id,stay_date) DO UPDATE SET
     allotment=excluded.allotment,rate_cents=excluded.rate_cents,stop_sell=excluded.stop_sell,updated_at=CURRENT_TIMESTAMP`)
     .bind(roomTypeId as string,stayDate as string,allotment as number,rateCents as number|null,stopSell?1:0).run();
  return NextResponse.json({ok:true},{headers:protectedHeaders});
 }catch{return NextResponse.json({error:'Unable to save nightly settings.'},{status:503,headers:protectedHeaders});}
}
