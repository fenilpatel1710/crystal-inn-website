import {NextResponse} from 'next/server';
import {firebaseSettings} from '../../../../../../lib/guest/firebase';
import {guestHeaders} from '../../../../../../lib/guest/auth';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
 try{
  const settings=firebaseSettings();
  if(settings.provider!=='firebase')return NextResponse.json({provider:'twilio',configured:false},{headers:guestHeaders});
  return NextResponse.json({provider:'firebase',configured:settings.configured,
   config:settings.configured?{
    apiKey:settings.apiKey,authDomain:settings.authDomain,projectId:settings.projectId,appId:settings.appId
   }:null
  },{headers:guestHeaders});
 }catch{return NextResponse.json({provider:'twilio',configured:false},{headers:guestHeaders});}
}
