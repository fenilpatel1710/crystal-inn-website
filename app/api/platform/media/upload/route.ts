import {NextRequest,NextResponse} from 'next/server';
import {getCloudflareContext} from '@opennextjs/cloudflare';
import {authorize,noStore} from '../../../../../lib/platform/auth';
export const runtime='nodejs';
export const dynamic='force-dynamic';

const MAX_BYTES=5*1024*1024;
type R2Bucket={put:(key:string,body:ArrayBuffer,options:{httpMetadata:{contentType:string}})=>Promise<unknown>;delete:(key:string)=>Promise<void>};
function detectImage(b:Uint8Array):{mime:string;extension:string}|null{
 if(b.length>=3&&b[0]===0xff&&b[1]===0xd8&&b[2]===0xff)return {mime:'image/jpeg',extension:'jpg'};
 if(b.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v))return {mime:'image/png',extension:'png'};
 if(b.length>=12&&String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP')return {mime:'image/webp',extension:'webp'};
 return null;
}
export async function POST(req:NextRequest){
 const a=await authorize(req,'platform');if(a instanceof NextResponse)return a;
 const contentLength=Number(req.headers.get('content-length')||0);
 if(contentLength>MAX_BYTES+20000)return NextResponse.json({error:'Image must be 5 MB or smaller.'},{status:413,headers:noStore});
 let form:FormData;
 try{form=await req.formData()}catch{return NextResponse.json({error:'Invalid photo upload.'},{status:400,headers:noStore})}
 const hotelId=form.get('hotelId'),file=form.get('photo');
 if(typeof hotelId!=='string'||!hotelId||hotelId.length>120||!(file instanceof File))
 return NextResponse.json({error:'Choose a hotel and an image to upload.'},{status:400,headers:noStore});
 if(file.size===0||file.size>MAX_BYTES)return NextResponse.json({error:'Upload a photo smaller than 5 MB.'},{status:413,headers:noStore});
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))
 return NextResponse.json({error:'Use a JPG, PNG or WebP photo.'},{status:415,headers:noStore});
 const bytes=await file.arrayBuffer();
 const detected=detectImage(new Uint8Array(bytes));
 if(!detected||detected.mime!==file.type)
 return NextResponse.json({error:'Invalid or unsupported image file.'},{status:415,headers:noStore});
 const media=(getCloudflareContext().env as unknown as {HOTEL_MEDIA?:R2Bucket}).HOTEL_MEDIA;
 if(!media)return NextResponse.json({error:'HOTEL_MEDIA R2 binding is not available on this deployment.'},{status:503,headers:noStore});
 const hotel=await a.db.prepare('SELECT id FROM hotels WHERE id=? AND archived_at IS NULL').bind(hotelId).first();
 if(!hotel)return NextResponse.json({error:'Hotel not found or archived.'},{status:404,headers:noStore});
 const key='hotels/'+hotelId+'/'+crypto.randomUUID()+'.'+detected.extension;
 try{await media.put(key,bytes,{httpMetadata:{contentType:detected.mime}})}
 catch{return NextResponse.json({error:'Cloudflare R2 upload failed.'},{status:503,headers:noStore})}
 try{
 await a.db.batch([
  a.db.prepare('UPDATE hotels SET hero_image_url=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind('r2:'+key,hotelId),
  a.db.prepare('INSERT INTO platform_admin_audit(id,actor_email,action,hotel_id,details) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),a.email,'upload_private_hotel_photo',hotelId,key)
 ]);
 return NextResponse.json({ok:true,objectKey:key,imagePath:'/api/public/media?hotel='+encodeURIComponent(hotelId),message:'Photo uploaded and assigned to this hotel.'},{headers:noStore});
 }catch{
 await media.delete(key).catch(()=>{});
 return NextResponse.json({error:'Photo uploaded but could not be assigned. Please retry.'},{status:503,headers:noStore});
 }
}
