import {NextRequest,NextResponse} from 'next/server';
import {getCloudflareContext} from '@opennextjs/cloudflare';
import {authorize,noStore} from '../../../../lib/platform/auth';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const MAX_PHOTOS=3;
const MAX_BYTES=5*1024*1024;
type R2Bucket={
 put:(key:string,body:ArrayBuffer,options:{httpMetadata:{contentType:string}})=>Promise<unknown>;
 delete:(key:string)=>Promise<void>;
};
type RoomPhoto={id:string;hotel_id:string;room_id:string;object_key:string;slot:number;created_at:string};
function bucket(){return (getCloudflareContext().env as unknown as {HOTEL_MEDIA?:R2Bucket}).HOTEL_MEDIA}
function typeFromBytes(b:Uint8Array):{mime:string;ext:string}|null{
 if(b.length>=3&&b[0]===255&&b[1]===216&&b[2]===255)return {mime:'image/jpeg',ext:'jpg'};
 if(b.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v))return {mime:'image/png',ext:'png'};
 if(b.length>=12&&String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP')return {mime:'image/webp',ext:'webp'};
 return null;
}
function validId(id:string){return id.length>0&&id.length<=120&&/^[a-zA-Z0-9-]+$/.test(id)}
async function access(req:NextRequest){
 const scope=req.nextUrl.searchParams.get('scope');
 if(scope!=='platform'&&scope!=='hotel')return NextResponse.json({error:'Choose platform or hotel management scope.'},{status:400,headers:noStore});
 const auth=await authorize(req,scope);
 if(auth instanceof NextResponse)return auth;
 return {auth,scope};
}
async function checkRoom(db:{prepare:(sql:string)=>{bind:(...args:(string|number|null)[])=>{first:()=>Promise<unknown>}}},hotelId:string,roomId:string){
 return db.prepare('SELECT r.id FROM hotel_room_types r JOIN hotels h ON h.id=r.hotel_id WHERE r.hotel_id=? AND r.id=? AND h.archived_at IS NULL').bind(hotelId,roomId).first();
}
function photoUrl(photo:RoomPhoto,scope:string){
 return '/api/management/room-photos/image?'+new URLSearchParams({scope,hotelId:photo.hotel_id,roomId:photo.room_id,photoId:photo.id}).toString();
}
function failure(message:string,status:number){return NextResponse.json({error:message},{status,headers:noStore})}

export async function GET(req:NextRequest){
 const a=await access(req);if(a instanceof NextResponse)return a;
 const hotelId=a.scope==='hotel'?a.auth.hotelId:req.nextUrl.searchParams.get('hotelId')||'';
 const roomId=req.nextUrl.searchParams.get('roomId')||'';
 if(!hotelId||!validId(hotelId)||!validId(roomId))return failure('Choose a valid hotel and room type.',400);
 if(!await checkRoom(a.auth.db,hotelId,roomId))return failure('Room type does not belong to this hotel.',404);
 try{
  const rows=await a.auth.db.prepare('SELECT id,hotel_id,room_id,object_key,slot,created_at FROM hotel_room_photos WHERE hotel_id=? AND room_id=? ORDER BY slot').bind(hotelId,roomId).all<RoomPhoto>();
  return NextResponse.json({photos:rows.results.map(p=>({id:p.id,slot:p.slot,url:photoUrl(p,a.scope)})),maxPhotos:MAX_PHOTOS},{headers:noStore});
 }catch{return failure('Room photo gallery is not available. Apply D1 migration 0007_private_room_galleries.sql once.',503)}
}

export async function POST(req:NextRequest){
 const a=await access(req);if(a instanceof NextResponse)return a;
 const length=Number(req.headers.get('content-length')||0);
 if(length>MAX_BYTES+25000)return failure('Room photo must be 5 MB or smaller.',413);
 let data:FormData;try{data=await req.formData()}catch{return failure('Invalid photo upload.',400)}
 const requestedHotel=data.get('hotelId'),room=data.get('roomId'),file=data.get('photo');
 const hotelId=a.scope==='hotel'?a.auth.hotelId:typeof requestedHotel==='string'?requestedHotel:'';
 const roomId=typeof room==='string'?room:'';
 if(!hotelId||!validId(hotelId)||!validId(roomId)||!(file instanceof File))return failure('Select a hotel, room type, and photo.',400);
 if(a.scope==='hotel'&&requestedHotel!==hotelId)return failure('You can manage only your assigned property.',403);
 if(!await checkRoom(a.auth.db,hotelId,roomId))return failure('Selected room does not belong to this hotel.',404);
 if(file.size<1||file.size>MAX_BYTES)return failure('Choose a photo 5 MB or smaller.',413);
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))return failure('Only JPG, PNG, or WebP images are supported.',415);
 const contents=await file.arrayBuffer();
 const detected=typeFromBytes(new Uint8Array(contents));
 if(!detected||detected.mime!==file.type)return failure('The selected file is not a valid JPG, PNG or WebP image.',415);
 const media=bucket();if(!media)return failure('Private HOTEL_MEDIA R2 binding is not configured.',503);
 let existing:RoomPhoto[];
 try{
  const rows=await a.auth.db.prepare('SELECT id,hotel_id,room_id,object_key,slot,created_at FROM hotel_room_photos WHERE hotel_id=? AND room_id=? ORDER BY slot').bind(hotelId,roomId).all<RoomPhoto>();
  existing=rows.results;
 }catch{return failure('Room gallery table is missing. Apply D1 migration 0007_private_room_galleries.sql once.',503)}
 const taken=new Set(existing.map(p=>p.slot));
 const slot=[1,2,3].find(s=>!taken.has(s));
 if(!slot)return failure('This room already has 3 photos. Remove one to upload another.',409);
 const id=crypto.randomUUID(),objectKey='room-photos/'+hotelId+'/'+roomId+'/'+id+'.'+detected.ext;
 // Reserve the unique room slot in D1 before uploading. Simultaneous requests cannot exceed three.
 try{
  await a.auth.db.prepare('INSERT INTO hotel_room_photos(id,hotel_id,room_id,object_key,slot) VALUES(?,?,?,?,?)').bind(id,hotelId,roomId,objectKey,slot).run();
 }catch{return failure('Room photo slot is unavailable. Refresh the gallery and try again. Verify D1 migration 0007.',409)}
 try{
  await media.put(objectKey,contents,{httpMetadata:{contentType:detected.mime}});
 }catch{
  await a.auth.db.prepare('DELETE FROM hotel_room_photos WHERE id=? AND hotel_id=?').bind(id,hotelId).run().catch(()=>{});
  return failure('Private R2 upload failed. Please retry.',503);
 }
 // Audit failure must not undo a successfully published photo.
 if(a.scope==='platform')await a.auth.db.prepare('INSERT INTO platform_admin_audit(id,actor_email,action,hotel_id,details) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),a.auth.email,'upload_room_photo',hotelId,roomId+' slot '+slot).run().catch(()=>{});
 return NextResponse.json({ok:true,photo:{id,slot,url:photoUrl({id,hotel_id:hotelId,room_id:roomId,object_key:objectKey,slot,created_at:''},a.scope)}},{headers:noStore});
}

export async function DELETE(req:NextRequest){
 const a=await access(req);if(a instanceof NextResponse)return a;
 let body:Record<string,unknown>;try{body=await req.json()}catch{return failure('Invalid request.',400)}
 const requestedHotel=String(body.hotelId||''),roomId=String(body.roomId||''),photoId=String(body.photoId||'');
 const hotelId=a.scope==='hotel'?a.auth.hotelId:requestedHotel;
 if(!hotelId||!validId(hotelId)||!validId(roomId)||!validId(photoId))return failure('Select a valid photo to remove.',400);
 if(a.scope==='hotel'&&requestedHotel!==hotelId)return failure('You can manage only your assigned property.',403);
 try{
  const photo=await a.auth.db.prepare('SELECT id,hotel_id,room_id,object_key,slot,created_at FROM hotel_room_photos WHERE id=? AND hotel_id=? AND room_id=?').bind(photoId,hotelId,roomId).first<RoomPhoto>();
  if(!photo)return failure('Photo not found in this room.',404);
  const media=bucket();if(!media)return failure('Private HOTEL_MEDIA R2 binding is not configured.',503);
  await a.auth.db.prepare('DELETE FROM hotel_room_photos WHERE id=? AND hotel_id=? AND room_id=?').bind(photoId,hotelId,roomId).run();
  // Once deleted from D1, the object cannot be accessed by any public or admin image route.
  await media.delete(photo.object_key).catch(()=>{});
  if(a.scope==='platform')await a.auth.db.prepare('INSERT INTO platform_admin_audit(id,actor_email,action,hotel_id,details) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),a.auth.email,'remove_room_photo',hotelId,roomId+' slot '+photo.slot).run().catch(()=>{});
  return NextResponse.json({ok:true},{headers:noStore});
 }catch{return failure('Unable to remove room photo. Verify D1 gallery setup.',503)}
}
