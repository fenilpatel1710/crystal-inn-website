import {NextRequest,NextResponse} from 'next/server';
import {getCloudflareContext} from '@opennextjs/cloudflare';
import {authorize,noStore} from '../../../../lib/platform/auth';
import {loadHomepageGallery,saveHomepageGallery,sanitizedGallery} from '../../../../lib/homepage-media';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const MAX_BYTES=5*1024*1024;
const validId=/^[0-9a-f-]{36}$/;
type Bucket={
 put:(key:string,bytes:ArrayBuffer,options:{httpMetadata:{contentType:string}})=>Promise<unknown>;
 delete:(key:string)=>Promise<void>;
};
function getBucket(){return (getCloudflareContext().env as unknown as {HOTEL_MEDIA?:Bucket}).HOTEL_MEDIA}
function detectImage(bytes:Uint8Array){
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return {mime:'image/jpeg',ext:'jpg'};
 if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b))return {mime:'image/png',ext:'png'};
 if(bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&
   String.fromCharCode(...bytes.slice(8,12))==='WEBP')return {mime:'image/webp',ext:'webp'};
 return null;
}
function err(message:string,status=400){
 return NextResponse.json({error:message},{status,headers:noStore});
}
export async function GET(req:NextRequest){
 const a=await authorize(req,'platform');if(a instanceof NextResponse)return a;
 try{return NextResponse.json(sanitizedGallery(await loadHomepageGallery(a.db)),{headers:noStore})}
 catch{return err('Homepage gallery requires the platform settings database migration.',503)}
}
export async function POST(req:NextRequest){
 const a=await authorize(req,'platform');if(a instanceof NextResponse)return a;
 const bucket=getBucket();if(!bucket)return err('Cloudflare R2 media binding is unavailable.',503);
 const length=Number(req.headers.get('content-length')||0);
 if(length>MAX_BYTES+30000)return err('Image must be no larger than 5 MB.',413);
 let form:FormData;
 try{form=await req.formData()}catch{return err('Invalid image upload.')}
 const photo=form.get('photo'), caption=String(form.get('caption')||'').trim();
 if(!(photo instanceof File)||!photo.size||photo.size>MAX_BYTES)return err('Choose a JPG, PNG or WebP photo under 5 MB.',413);
 if(caption.length>90)return err('Caption must be 90 characters or fewer.');
 if(!['image/jpeg','image/png','image/webp'].includes(photo.type))return err('Use a JPG, PNG or WebP image.',415);
 let bytes:ArrayBuffer;
 try{bytes=await photo.arrayBuffer()}catch{return err('Unable to read this photo.')}
 const image=detectImage(new Uint8Array(bytes));
 if(!image||image.mime!==photo.type)return err('Invalid image type.',415);
 let gallery;
 try{gallery=await loadHomepageGallery(a.db)}catch{return err('Platform settings database is unavailable.',503)}
 if(gallery.photos.length>=8)return err('Homepage gallery has reached 8 images. Remove an older image first.',409);
 const id=crypto.randomUUID(),key='site/homepage/'+id+'.'+image.ext;
 try{await bucket.put(key,bytes,{httpMetadata:{contentType:image.mime}})}
 catch{return err('Unable to upload photo to private R2.',503)}
 const next={activeId:id,photos:[...gallery.photos,{id,key,caption:caption||'Crystal Inn Hotels & Stays'}]};
 try{
  await saveHomepageGallery(a.db,next);
  await a.db.prepare('INSERT INTO platform_admin_audit(id,actor_email,action,details) VALUES(?,?,?,?)')
   .bind(crypto.randomUUID(),a.email,'homepage_photo_upload',id).run().catch(()=>{});
  return NextResponse.json({ok:true,...sanitizedGallery(next)},{headers:noStore});
 }catch{
  await bucket.delete(key).catch(()=>{});
  return err('Photo uploaded but could not be saved to the homepage.',503);
 }
}
export async function PUT(req:NextRequest){
 const a=await authorize(req,'platform');if(a instanceof NextResponse)return a;
 let body:{action?:unknown;id?:unknown;caption?:unknown};
 try{body=await req.json()}catch{return err('Invalid change request.')}
 const action=body.action,id=body.id;
 if((action!=='activate'&&action!=='caption')||typeof id!=='string'||!validId.test(id))return err('Invalid photo selection.');
 const caption=typeof body.caption==='string'?body.caption.trim():'';
 if(action==='caption'&&caption.length>90)return err('Caption must be 90 characters or fewer.');
 try{
  const gallery=await loadHomepageGallery(a.db);
  if(!gallery.photos.some(p=>p.id===id))return err('Photo not found.',404);
  if(action==='activate')gallery.activeId=id;
  else gallery.photos=gallery.photos.map(p=>p.id===id?{...p,caption}:p);
  await saveHomepageGallery(a.db,gallery);
  await a.db.prepare('INSERT INTO platform_admin_audit(id,actor_email,action,details) VALUES(?,?,?,?)')
   .bind(crypto.randomUUID(),a.email,action==='activate'?'homepage_photo_activate':'homepage_photo_caption',id).run().catch(()=>{});
  return NextResponse.json({ok:true,...sanitizedGallery(gallery)},{headers:noStore});
 }catch{return err('Unable to update homepage photo.',503)}
}
export async function DELETE(req:NextRequest){
 const a=await authorize(req,'platform');if(a instanceof NextResponse)return a;
 let body:{id?:unknown};
 try{body=await req.json()}catch{return err('Invalid deletion request.')}
 if(typeof body.id!=='string'||!validId.test(body.id))return err('Invalid photo.');
 const bucket=getBucket();if(!bucket)return err('R2 media binding unavailable.',503);
 try{
  const gallery=await loadHomepageGallery(a.db),photo=gallery.photos.find(p=>p.id===body.id);
  if(!photo)return err('Photo not found.',404);
  const remaining=gallery.photos.filter(p=>p.id!==photo.id);
  const next={activeId:gallery.activeId===photo.id?(remaining[0]?.id||null):gallery.activeId,photos:remaining};
  await saveHomepageGallery(a.db,next);
  await a.db.prepare('INSERT INTO platform_admin_audit(id,actor_email,action,details) VALUES(?,?,?,?)')
   .bind(crypto.randomUUID(),a.email,'homepage_photo_delete',photo.id).run().catch(()=>{});
  // The public endpoint no longer accepts the deleted ID even if R2 cleanup fails.
  await bucket.delete(photo.key).catch(()=>{});
  return NextResponse.json({ok:true,...sanitizedGallery(next)},{headers:noStore});
 }catch{return err('Unable to remove homepage photo.',503)}
}
