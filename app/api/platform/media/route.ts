import {NextRequest,NextResponse} from 'next/server';
import {getCloudflareContext} from '@opennextjs/cloudflare';
import {authorize,noStore} from '../../../../lib/platform/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
type Bucket={head:(key:string)=>Promise<{httpMetadata?:{contentType?:string};size:number}|null>};
function bucket(){return (getCloudflareContext().env as unknown as {HOTEL_MEDIA?:Bucket}).HOTEL_MEDIA}
export async function POST(req:NextRequest){
 const a=await authorize(req,'platform');if(a instanceof NextResponse)return a;
 let body:Record<string,unknown>;try{body=await req.json()}catch{return NextResponse.json({error:'Invalid JSON'},{status:400,headers:noStore})}
 const hotelId=String(body.hotelId||''),objectKey=String(body.objectKey||'').trim();
 if(!hotelId||hotelId.length>120||!objectKey||objectKey.length>500||objectKey.startsWith('/')||objectKey.includes('..')||/[\x00-\x1f]/.test(objectKey))
 return NextResponse.json({error:'Invalid hotel or R2 object key.'},{status:400,headers:noStore});
 const media=bucket();
 if(!media)return NextResponse.json({error:'HOTEL_MEDIA binding is missing on this deployment.'},{status:503,headers:noStore});
 try{
 const hotel=await a.db.prepare('SELECT id FROM hotels WHERE id=? AND archived_at IS NULL').bind(hotelId).first();
 if(!hotel)return NextResponse.json({error:'Hotel not found or archived.'},{status:404,headers:noStore});
 const object=await media.head(objectKey);
 if(!object)return NextResponse.json({error:'Object not found in the private R2 bucket. Check its exact key and capitalization.'},{status:404,headers:noStore});
 const contentType=object.httpMetadata?.contentType||'';
 if(!/^image\/(jpeg|png|webp|avif)$/.test(contentType))
 return NextResponse.json({error:'R2 object must have an image Content-Type (image/jpeg, image/png, image/webp or image/avif). Update its metadata in R2.'},{status:400,headers:noStore});
 await a.db.batch([
  a.db.prepare('UPDATE hotels SET hero_image_url=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind('r2:'+objectKey,hotelId),
  a.db.prepare('INSERT INTO platform_admin_audit(id,actor_email,action,hotel_id,details) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),a.email,'assign_private_r2_hero',hotelId,objectKey)
 ]);
 return NextResponse.json({ok:true,publicImagePath:'/api/public/media?hotel='+encodeURIComponent(hotelId)},{headers:noStore});
 }catch{return NextResponse.json({error:'Unable to verify or assign the private hotel photo.'},{status:503,headers:noStore})}
}
