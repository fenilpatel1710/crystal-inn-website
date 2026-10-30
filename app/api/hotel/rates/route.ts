import {NextRequest,NextResponse} from 'next/server';
import {authorize,noStore} from '../../../../lib/platform/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const a=await authorize(req,'hotel');if(a instanceof NextResponse)return a;
 const from=new URL(req.url).searchParams.get('from')||new Date().toISOString().slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(from))return NextResponse.json({error:'Invalid date'},{status:400,headers:noStore});
 try{const rows=await a.db.prepare('SELECT room_type_id,stay_date,rate_cents,allotment,stop_sell FROM hotel_nightly_inventory WHERE hotel_id=? AND stay_date>=? ORDER BY stay_date LIMIT 200').bind(a.hotelId,from).all();
 return NextResponse.json({rates:rows.results},{headers:noStore})
 }catch{return NextResponse.json({error:'Rates unavailable.'},{status:503,headers:noStore})}
}
export async function PUT(req:NextRequest){
 const a=await authorize(req,'hotel');if(a instanceof NextResponse)return a;
 let b:Record<string,unknown>;try{b=await req.json()}catch{return NextResponse.json({error:'Invalid input'},{status:400,headers:noStore})}
 const roomId=String(b.roomId||''),date=String(b.date||''),rate=b.rateCents,allotment=b.allotment,stopSell=b.stopSell;
 if(!roomId||!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date||
 typeof rate!=='number'||!Number.isInteger(rate)||rate<0||rate>1000000||typeof allotment!=='number'||!Number.isInteger(allotment)||allotment<0||allotment>1000||typeof stopSell!=='boolean')
 return NextResponse.json({error:'Enter a valid date, room, inventory and rate.'},{status:400,headers:noStore});
 try{
 const row=await a.db.prepare('SELECT id FROM hotel_room_types WHERE id=? AND hotel_id=? AND is_active=1').bind(roomId,a.hotelId).first();
 if(!row)return NextResponse.json({error:'Room does not belong to this hotel.'},{status:403,headers:noStore});
 await a.db.prepare(`INSERT INTO hotel_nightly_inventory(hotel_id,room_type_id,stay_date,allotment,rate_cents,stop_sell)
 VALUES(?,?,?,?,?,?) ON CONFLICT(hotel_id,room_type_id,stay_date) DO UPDATE SET
 allotment=excluded.allotment,rate_cents=excluded.rate_cents,stop_sell=excluded.stop_sell,updated_at=CURRENT_TIMESTAMP`)
 .bind(a.hotelId,roomId,date,allotment,rate,stopSell?1:0).run();
 return NextResponse.json({ok:true},{headers:noStore})
 }catch{return NextResponse.json({error:'Unable to save rate.'},{status:503,headers:noStore})}
}
