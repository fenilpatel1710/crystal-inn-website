import {NextRequest,NextResponse} from 'next/server';
import {authorize,noStore} from '../../../../lib/platform/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const a=await authorize(req,'platform');if(a instanceof NextResponse)return a;
 try{
 const rows=await a.db.prepare('SELECT id,actor_email,action,hotel_id,manager_id,details,created_at FROM platform_admin_audit ORDER BY created_at DESC LIMIT 100').all();
 return NextResponse.json({events:rows.results},{headers:noStore});
 }catch{return NextResponse.json({error:'Audit history unavailable. Apply migration 0004.'},{status:503,headers:noStore})}
}
