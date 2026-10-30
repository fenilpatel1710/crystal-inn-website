import {NextRequest,NextResponse} from 'next/server';
import {authorize,noStore} from '../../../../lib/platform/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
const defaults={contact_email:'frontdesk@crystalinnstay.com',rewards_points_per_dollar:'3',rewards_minimum_redemption:'1000'};
export async function GET(req:NextRequest){
 const a=await authorize(req,'platform');if(a instanceof NextResponse)return a;
 try{const data=await a.db.prepare('SELECT setting_key,setting_value FROM platform_settings').all<{setting_key:string;setting_value:string}>();
 return NextResponse.json({settings:{...defaults,...Object.fromEntries(data.results.map(x=>[x.setting_key,x.setting_value]))}},{headers:noStore})}
 catch{return NextResponse.json({error:'Platform settings unavailable.'},{status:503,headers:noStore})}
}
export async function PUT(req:NextRequest){
 const a=await authorize(req,'platform');if(a instanceof NextResponse)return a;
 let b:Record<string,unknown>;try{b=await req.json()}catch{return NextResponse.json({error:'Invalid input.'},{status:400,headers:noStore})}
 const email=String(b.contact_email||'').trim().toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>190||
 String(b.rewards_points_per_dollar)!=='3'||String(b.rewards_minimum_redemption)!=='1000')
 return NextResponse.json({error:'Enter a valid central contact email. Rewards rules remain 3 points per eligible dollar and 1000 minimum until transactional rewards are integrated.'},{status:400,headers:noStore});
 try{await a.db.batch([
 a.db.prepare("INSERT INTO platform_settings(setting_key,setting_value) VALUES('contact_email',?) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_at=CURRENT_TIMESTAMP").bind(email),
 a.db.prepare('INSERT INTO platform_admin_audit(id,actor_email,action,details) VALUES(?,?,?,?)').bind(crypto.randomUUID(),a.email,'update_platform_settings','contact email')
 ]);return NextResponse.json({ok:true},{headers:noStore})}
 catch{return NextResponse.json({error:'Settings save unavailable.'},{status:503,headers:noStore})}
}
