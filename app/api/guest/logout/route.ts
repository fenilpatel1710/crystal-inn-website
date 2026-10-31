import {NextRequest,NextResponse} from 'next/server';
import {guestEnv,sameOrigin,GUEST_COOKIE,hash,guestHeaders} from '../../../../lib/guest/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(req:NextRequest){
 if(!sameOrigin(req))return NextResponse.json({error:'Invalid request origin.'},{status:403,headers:guestHeaders});
 const e=guestEnv(),token=req.cookies.get(GUEST_COOKIE)?.value;
 if(e.db&&token)await e.db.prepare('DELETE FROM portal_guest_sessions WHERE token_hash=?').bind(hash(token)).run().catch(()=>{});
 const response=NextResponse.json({ok:true},{headers:guestHeaders});
 response.cookies.set(GUEST_COOKIE,'',{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:0});
 return response;
}
