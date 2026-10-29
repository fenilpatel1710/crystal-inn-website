import {NextRequest,NextResponse} from 'next/server';
import {COOKIE,originOk,protectedHeaders} from '../../../../lib/admin/auth';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 if(!originOk(req))return NextResponse.json({error:'Invalid request origin.'},{status:403,headers:protectedHeaders});
 const result=NextResponse.json({ok:true},{headers:protectedHeaders});
 result.cookies.set(COOKIE,'',{httpOnly:true,secure:true,sameSite:'strict',path:'/',maxAge:0});
 return result;
}
