import {NextResponse} from 'next/server';
import {environment,noStore} from '../../../../lib/platform/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){
 try{
 const e=environment();if(!e.db)throw Error('No database');
 const hotels=await e.db.prepare(`SELECT id,display_name,city,region FROM hotels WHERE status='active' AND archived_at IS NULL ORDER BY display_name`).all();
 return NextResponse.json({hotels:hotels.results},{headers:noStore});
 }catch{return NextResponse.json({hotels:[]},{headers:noStore})}
}
