import {NextRequest,NextResponse} from 'next/server';
import {getCloudflareContext} from '@opennextjs/cloudflare';
import {authorize,noStore} from '../../../../lib/platform/auth';
import type {DB} from '../../../../lib/admin/auth';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const MAX_PHOTOS=3;
const MAX_BYTES=5*1024*1024;

type R2Bucket={
 put:(key:string,body:ArrayBuffer,options:{httpMetadata:{contentType:string}})=>Promise<unknown>;
};
type GalleryRow={id:string;hotel_id:string;room_id:string;asset_id:string;slot:number;created_at:string};
type MediaAsset={id:string;hotel_id:string;object_key:string;created_at:string;assigned_count:number};
function bucket(){return (getCloudflareContext().env as unknown as {HOTEL_MEDIA?:R2Bucket}).HOTEL_MEDIA}
function photoType(bytes:Uint8Array):{mime:string;ext:string}|null{
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return {mime:'image/jpeg',ext:'jpg'};
 if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return {mime:'image/png',ext:'png'};
 if(bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return {mime:'image/webp',ext:'webp'};
 return null;
}
function validId(id:string){return id.length>0&&id.length<=120&&/^[a-zA-Z0-9-]+$/.test(id)}
function failure(message:string,status:number){return NextResponse.json({error:message},{status,headers:noStore})}
async function access(req:NextRequest){
 const scope=req.nextUrl.searchParams.get('scope');
 if(scope!=='platform'&&scope!=='hotel')return failure('Choose platform or hotel management scope.',400);
 const auth=await authorize(req,scope);
 if(auth instanceof NextResponse)return auth;
 return {auth,scope};
}
async function hasRoom(db:DB,hotelId:string,roomId:string){
 return db.prepare('SELECT r.id FROM hotel_room_types r JOIN hotels h ON h.id=r.hotel_id WHERE r.hotel_id=? AND r.id=? AND h.archived_at IS NULL')
  .bind(hotelId,roomId).first<{id:string}>();
}
function assignedUrl(p:GalleryRow,scope:string){
 return '/api/management/room-photos/image?'+new URLSearchParams({scope,hotelId:p.hotel_id,roomId:p.room_id,photoId:p.id}).toString();
}
function assetUrl(hotelId:string,assetId:string,scope:string){
 return '/api/management/room-photos/library-image?'+new URLSearchParams({scope,hotelId,assetId}).toString();
}

export async function GET(req:NextRequest){
 const a=await access(req);if(a instanceof NextResponse)return a;
 const hotelId=a.scope==='hotel'?a.auth.hotelId:req.nextUrl.searchParams.get('hotelId')||'';
 if(!hotelId||!validId(hotelId))return failure('Choose a hotel.',400);
 if(a.scope==='hotel'&&req.nextUrl.searchParams.get('hotelId')!==hotelId)return failure('Wrong hotel.',403);
 try{
  if(req.nextUrl.searchParams.get('library')==='1'){
   // Private library is per hotel; an image may be assigned to more than one room.
   const data=await a.auth.db.prepare(`SELECT a.id,a.hotel_id,a.object_key,a.created_at,COUNT(g.id) AS assigned_count
    FROM hotel_media_assets a LEFT JOIN hotel_room_gallery g ON g.asset_id=a.id
    WHERE a.hotel_id=? GROUP BY a.id ORDER BY a.created_at DESC,a.id DESC LIMIT 200`)
    .bind(hotelId).all<MediaAsset>();
   return NextResponse.json({assets:data.results.map(p=>({id:p.id,url:assetUrl(hotelId,p.id,a.scope),assignedCount:p.assigned_count,createdAt:p.created_at}))},{headers:noStore});
  }
  const roomId=req.nextUrl.searchParams.get('roomId')||'';
  if(!validId(roomId)||!await hasRoom(a.auth.db,hotelId,roomId))return failure('Room type does not belong to this hotel.',404);
  const data=await a.auth.db.prepare('SELECT id,hotel_id,room_id,asset_id,slot,created_at FROM hotel_room_gallery WHERE hotel_id=? AND room_id=? ORDER BY slot')
    .bind(hotelId,roomId).all<GalleryRow>();
  return NextResponse.json({photos:data.results.map(p=>({id:p.id,slot:p.slot,url:assignedUrl(p,a.scope),assetId:p.asset_id})),maxPhotos:MAX_PHOTOS},{headers:noStore});
 }catch{return failure('Media library unavailable. Back up D1 and apply migrations 0007 and 0008 in order.',503)}
}

export async function POST(req:NextRequest){
 const a=await access(req);if(a instanceof NextResponse)return a;
 const length=Number(req.headers.get('content-length')||0);
 if(length>MAX_BYTES+25000)return failure('Photo must be 5 MB or smaller.',413);
 let data:FormData;try{data=await req.formData()}catch{return failure('Invalid photo upload.',400)}
 const requestedHotel=data.get('hotelId'),room=data.get('roomId'),file=data.get('photo');
 const hotelId=a.scope==='hotel'?a.auth.hotelId:typeof requestedHotel==='string'?requestedHotel:'';
 const roomId=typeof room==='string'?room:'';
 if(!hotelId||!validId(hotelId)||!validId(roomId)||!(file instanceof File))return failure('Select a hotel, room and photo.',400);
 if(a.scope==='hotel'&&requestedHotel!==hotelId)return failure('You can manage only your assigned hotel.',403);
 if(!await hasRoom(a.auth.db,hotelId,roomId))return failure('Room does not belong to hotel.',404);
 if(file.size<1||file.size>MAX_BYTES)return failure('Use a file under 5 MB.',413);
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))return failure('JPG, PNG or WebP required.',415);
 const contents=await file.arrayBuffer(),detected=photoType(new Uint8Array(contents));
 if(!detected||detected.mime!==file.type)return failure('Invalid image content.',415);
 const media=bucket();if(!media)return failure('Private R2 binding missing.',503);
 const assetId=crypto.randomUUID(),id=crypto.randomUUID();
 const objectKey='shared-room-media/'+hotelId+'/'+assetId+'.'+detected.ext;
 try{
  const data=await a.auth.db.prepare('SELECT slot FROM hotel_room_gallery WHERE hotel_id=? AND room_id=?').bind(hotelId,roomId).all<{slot:number}>();
  const used=new Set(data.results.map(p=>p.slot));
  const slot=[1,2,3].find(n=>!used.has(n));if(!slot)return failure('Room has 3 photos. Remove one first.',409);
  // D1 batch commits both inserts or neither. Unique slot constraint enforces limit under concurrency.
  await a.auth.db.batch([
   a.auth.db.prepare('INSERT INTO hotel_media_assets(id,hotel_id,object_key) VALUES(?,?,?)').bind(assetId,hotelId,objectKey),
   a.auth.db.prepare('INSERT INTO hotel_room_gallery(id,hotel_id,room_id,asset_id,slot) VALUES(?,?,?,?,?)').bind(id,hotelId,roomId,assetId,slot)
  ]);
  try{await media.put(objectKey,contents,{httpMetadata:{contentType:detected.mime}})}
  catch{
   await a.auth.db.batch([
    a.auth.db.prepare('DELETE FROM hotel_room_gallery WHERE id=? AND hotel_id=?').bind(id,hotelId),
    a.auth.db.prepare('DELETE FROM hotel_media_assets WHERE id=? AND hotel_id=?').bind(assetId,hotelId)
   ]).catch(()=>{});
   return failure('R2 photo upload failed; try again.',503);
  }
  if(a.scope==='platform')await a.auth.db.prepare('INSERT INTO platform_admin_audit(id,actor_email,action,hotel_id,details) VALUES(?,?,?,?,?)')
   .bind(crypto.randomUUID(),a.auth.email,'upload_room_photo',hotelId,roomId+' slot '+slot).run().catch(()=>{});
  return NextResponse.json({ok:true,photo:{id,slot,assetId}},{headers:noStore});
 }catch{return failure('Photo slot unavailable. Refresh the gallery and verify migration 0008.',409)}
}

export async function PUT(req:NextRequest){
 const a=await access(req);if(a instanceof NextResponse)return a;
 let data:Record<string,unknown>;try{data=await req.json()}catch{return failure('Invalid request.',400)}
 const requestedHotel=String(data.hotelId||''),roomId=String(data.roomId||''),assetId=String(data.assetId||'');
 const hotelId=a.scope==='hotel'?a.auth.hotelId:requestedHotel;
 if(!hotelId||!validId(hotelId)||!validId(roomId)||!validId(assetId))return failure('Select a valid image and room.',400);
 if(a.scope==='hotel'&&requestedHotel!==hotelId)return failure('Wrong property.',403);
 try{
  if(!await hasRoom(a.auth.db,hotelId,roomId))return failure('Room does not belong to hotel.',404);
  const asset=await a.auth.db.prepare('SELECT id FROM hotel_media_assets WHERE id=? AND hotel_id=?').bind(assetId,hotelId).first();
  if(!asset)return failure('The selected photo is not in this hotel library.',404);
  const assigned=await a.auth.db.prepare('SELECT slot,asset_id FROM hotel_room_gallery WHERE room_id=? AND hotel_id=?')
   .bind(roomId,hotelId).all<{slot:number;asset_id:string}>();
  if(assigned.results.some(p=>p.asset_id===assetId))return failure('This photo is already assigned to this room.',409);
  const slot=[1,2,3].find(n=>!assigned.results.some(p=>p.slot===n));
  if(!slot)return failure('Room already has 3 photos.',409);
  await a.auth.db.prepare('INSERT INTO hotel_room_gallery(id,hotel_id,room_id,asset_id,slot) VALUES(?,?,?,?,?)')
   .bind(crypto.randomUUID(),hotelId,roomId,assetId,slot).run();
  if(a.scope==='platform')await a.auth.db.prepare('INSERT INTO platform_admin_audit(id,actor_email,action,hotel_id,details) VALUES(?,?,?,?,?)')
   .bind(crypto.randomUUID(),a.auth.email,'reuse_room_photo',hotelId,roomId+' slot '+slot).run().catch(()=>{});
  return NextResponse.json({ok:true,slot},{headers:noStore});
 }catch{return failure('Unable to assign photo. Verify migration 0008 or refresh slots.',409)}
}

export async function DELETE(req:NextRequest){
 const a=await access(req);if(a instanceof NextResponse)return a;
 let body:Record<string,unknown>;try{body=await req.json()}catch{return failure('Invalid request.',400)}
 const requestedHotel=String(body.hotelId||''),roomId=String(body.roomId||''),photoId=String(body.photoId||'');
 const hotelId=a.scope==='hotel'?a.auth.hotelId:requestedHotel;
 if(!hotelId||!validId(hotelId)||!validId(roomId)||!validId(photoId))return failure('Select a valid photo.',400);
 if(a.scope==='hotel'&&requestedHotel!==hotelId)return failure('Wrong property.',403);
 try{
  const assigned=await a.auth.db.prepare('SELECT id,slot FROM hotel_room_gallery WHERE id=? AND hotel_id=? AND room_id=?')
   .bind(photoId,hotelId,roomId).first<{id:string;slot:number}>();
  if(!assigned)return failure('Photo not assigned to this room.',404);
  await a.auth.db.prepare('DELETE FROM hotel_room_gallery WHERE id=? AND hotel_id=? AND room_id=?').bind(photoId,hotelId,roomId).run();
  // Deliberately retain the R2 object and media asset so other rooms are unaffected
  // and the same image remains selectable in this hotel's library.
  if(a.scope==='platform')await a.auth.db.prepare('INSERT INTO platform_admin_audit(id,actor_email,action,hotel_id,details) VALUES(?,?,?,?,?)')
   .bind(crypto.randomUUID(),a.auth.email,'detach_room_photo',hotelId,roomId+' slot '+assigned.slot).run().catch(()=>{});
  return NextResponse.json({ok:true},{headers:noStore});
 }catch{return failure('Unable to remove room photo.',503)}
}
