import {NextResponse} from 'next/server';
import {environment,noStore} from '../../../../lib/platform/auth';
import {loadHomepageGallery,sanitizedGallery} from '../../../../lib/homepage-media';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){
 try{
  const env=environment();
  if(!env.db)throw Error('DB unavailable');
  return NextResponse.json(sanitizedGallery(await loadHomepageGallery(env.db)),{headers:noStore});
 }catch{return NextResponse.json({activeId:null,photos:[]},{headers:noStore})}
}
