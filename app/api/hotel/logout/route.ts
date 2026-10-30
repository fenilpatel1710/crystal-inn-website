import {NextRequest,NextResponse} from 'next/server';
import {originValid,HOTEL_COOKIE,noStore} from '../../../../lib/platform/auth';
export async function POST(req:NextRequest){
 if(!originValid(req))return NextResponse.json({error:'Invalid origin'},{status:403,headers:noStore});
 const r=NextResponse.json({ok:true},{headers:noStore});r.cookies.set(HOTEL_COOKIE,'',{path:'/',maxAge:0});return r;
}
