import 'server-only';
import type {DB} from './admin/auth';

export type HomepagePhoto={id:string;key:string;caption:string};
export type HomepageGallery={activeId:string|null;photos:HomepagePhoto[]};
export const HOMEPAGE_MEDIA_KEY='homepage_media_gallery_v1';
const imageKey=/^site\/homepage\/[0-9a-f-]{36}\.(jpg|png|webp)$/;
const imageId=/^[0-9a-f-]{36}$/;

export function cleanGallery(raw:string|null|undefined):HomepageGallery{
 const empty:HomepageGallery={activeId:null,photos:[]};
 if(!raw)return empty;
 try{
  const value=JSON.parse(raw) as Partial<HomepageGallery>;
  if(!Array.isArray(value.photos))return empty;
  const ids=new Set<string>();
  const photos:HomepagePhoto[]=[];
  for(const photo of value.photos){
   if(!photo||typeof photo.id!=='string'||!imageId.test(photo.id)||
      typeof photo.key!=='string'||!imageKey.test(photo.key)||
      typeof photo.caption!=='string'||ids.has(photo.id))continue;
   ids.add(photo.id);
   photos.push({id:photo.id,key:photo.key,caption:photo.caption.slice(0,90)});
   if(photos.length>=8)break;
  }
  const activeId=typeof value.activeId==='string'&&ids.has(value.activeId)?value.activeId:photos[0]?.id||null;
  return {activeId,photos};
 }catch{return empty}
}
export async function loadHomepageGallery(db:DB):Promise<HomepageGallery>{
 const row=await db.prepare('SELECT setting_value FROM platform_settings WHERE setting_key=?')
  .bind(HOMEPAGE_MEDIA_KEY).first<{setting_value:string}>();
 return cleanGallery(row?.setting_value);
}
export async function saveHomepageGallery(db:DB, gallery:HomepageGallery){
 const value=JSON.stringify(gallery);
 await db.prepare(`INSERT INTO platform_settings(setting_key,setting_value,updated_at)
 VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(setting_key) DO UPDATE SET
 setting_value=excluded.setting_value,updated_at=CURRENT_TIMESTAMP`)
 .bind(HOMEPAGE_MEDIA_KEY,value).run();
}
export function homepagePhotoUrl(id:string){return '/api/public/homepage/photo?id='+encodeURIComponent(id)}
export function sanitizedGallery(gallery:HomepageGallery){
 return {activeId:gallery.activeId,photos:gallery.photos.map(({id,caption})=>({id,caption,url:homepagePhotoUrl(id)}))};
}
