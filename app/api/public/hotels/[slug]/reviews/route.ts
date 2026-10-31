import {NextRequest,NextResponse} from 'next/server';
import {environment,noStore} from '../../../../../../lib/platform/auth';
import {guestSession,sameOrigin} from '../../../../../../lib/guest/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
const validSlug=(slug:string)=>/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)&&slug.length<=64;
type Context={params:Promise<{slug:string}>};
async function target(slug:string){
 if(!validSlug(slug))return null;
 const e=environment();if(!e.db)return null;
 const hotel=await e.db.prepare("SELECT id FROM hotels WHERE slug=? AND status='active' AND archived_at IS NULL").bind(slug).first<{id:string}>();
 return hotel&&{db:e.db,hotelId:hotel.id};
}
export async function GET(req:NextRequest,{params}:Context){
 const {slug}=await params;
 try{
  const t=await target(slug);
  if(!t)return NextResponse.json({error:'Hotel not found.'},{status:404,headers:noStore});
  const [rows,summary]=await Promise.all([
   t.db.prepare(`SELECT rating,review_text,created_at FROM hotel_guest_reviews
     WHERE hotel_id=? AND status='published' ORDER BY created_at DESC LIMIT 30`)
      .bind(t.hotelId).all<{rating:number;review_text:string;created_at:string}>(),
   t.db.prepare(`SELECT COUNT(*) AS count,AVG(rating) AS average
     FROM hotel_guest_reviews WHERE hotel_id=? AND status='published'`)
      .bind(t.hotelId).first<{count:number;average:number|null}>()
  ]);
  const guest=await guestSession(req);
  let ownReview:null|{rating:number;reviewText:string;status:string}=null;
  if(guest?.hotel_id===t.hotelId){
   const own=await t.db.prepare('SELECT rating,review_text,status FROM hotel_guest_reviews WHERE hotel_id=? AND portal_user_id=?')
    .bind(t.hotelId,guest.user_id).first<{rating:number;review_text:string;status:string}>();
   if(own)ownReview={rating:own.rating,reviewText:own.review_text,status:own.status};
  }
  return NextResponse.json({
   reviews:rows.results,summary:{count:summary?.count||0,average:summary?.average??null},
   canReview:Boolean(guest?.hotel_id===t.hotelId),ownReview
  },{headers:noStore});
 }catch{return NextResponse.json({error:'Hotel reviews temporarily unavailable.'},{status:503,headers:noStore})}
}
export async function POST(req:NextRequest,{params}:Context){
 if(!sameOrigin(req))return NextResponse.json({error:'Invalid request origin.'},{status:403,headers:noStore});
 const {slug}=await params;
 try{
  const t=await target(slug);
  if(!t)return NextResponse.json({error:'Hotel not found.'},{status:404,headers:noStore});
  const guest=await guestSession(req);
  if(!guest)return NextResponse.json({error:'Sign in and verify your phone to review this hotel.'},{status:401,headers:noStore});
  if(guest.hotel_id!==t.hotelId)return NextResponse.json({error:'Sign in to this specific hotel to leave a review.'},{status:403,headers:noStore});
  if(Number(req.headers.get('content-length')||0)>4000)return NextResponse.json({error:'Review is too long.'},{status:413,headers:noStore});
  const b=await req.json() as Record<string,unknown>;
  const rating=Number(b.rating),reviewText=typeof b.reviewText==='string'?b.reviewText.trim():'';
  if(!Number.isInteger(rating)||rating<1||rating>5||reviewText.length<10||reviewText.length>1200)
   return NextResponse.json({error:'Select 1–5 stars and write a review of 10–1,200 characters.'},{status:400,headers:noStore});
  // A hidden review must not be republished by its author without staff moderation.
  const old=await t.db.prepare('SELECT status FROM hotel_guest_reviews WHERE hotel_id=? AND portal_user_id=?')
   .bind(t.hotelId,guest.user_id).first<{status:string}>();
  if(old?.status==='hidden')return NextResponse.json({error:'This review is under moderation. Contact the hotel before editing.'},{status:409,headers:noStore});
  await t.db.prepare(`INSERT INTO hotel_guest_reviews(id,hotel_id,portal_user_id,rating,review_text,status)
     VALUES(?,?,?,?,?,'published')
     ON CONFLICT(hotel_id,portal_user_id) DO UPDATE SET
       rating=excluded.rating,review_text=excluded.review_text,updated_at=CURRENT_TIMESTAMP`)
   .bind(crypto.randomUUID(),t.hotelId,guest.user_id,rating,reviewText).run();
  return NextResponse.json({ok:true},{headers:noStore});
 }catch{return NextResponse.json({error:'Unable to save review. Check your session and try again.'},{status:503,headers:noStore})}
}
