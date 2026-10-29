import {NextRequest,NextResponse} from 'next/server';
import {requireAdmin,protectedHeaders} from '../../../../lib/admin/auth';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const auth=await requireAdmin(req);
 if(auth instanceof NextResponse)return auth;
 const status=new URL(req.url).searchParams.get('status');
 const allowed=['request_received','pending_review','confirmed','cancel_requested','cancelled','rejected'];
 try{
  const sql=`SELECT public_reference,first_name,last_name,phone_e164,email,room_type_label,check_in,check_out,
   rooms_count,guests_count,booking_status,lumen_sync_status,special_requests,created_at
   FROM reservations ${status&&allowed.includes(status)?'WHERE booking_status = ?':''}
   ORDER BY created_at DESC LIMIT 200`;
  const stmt=auth.db.prepare(sql);
  const {results}=await (status&&allowed.includes(status)?stmt.bind(status):stmt).all();
  return NextResponse.json({reservations:results},{headers:protectedHeaders});
 }catch{return NextResponse.json({error:'Unable to load reservations.'},{status:503,headers:protectedHeaders});}
}
