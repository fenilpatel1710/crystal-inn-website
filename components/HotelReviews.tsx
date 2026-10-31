'use client';
import {useEffect,useState,type FormEvent} from 'react';
import './hotel-extras.css';
type Review={rating:number;review_text:string;created_at:string};
type ReviewData={
 reviews:Review[];summary:{count:number;average:number|null};canReview:boolean;
 ownReview:{rating:number;reviewText:string;status:string}|null
};
type GoogleData={rating:number|null;userRatingCount:number|null;writeReviewUrl:string|null;reviewsUrl:string|null;connected:boolean;source:string};
export default function HotelReviews({slug}:{slug:string}){
 const [data,setData]=useState<ReviewData|null>(null),[google,setGoogle]=useState<GoogleData|null>(null);
 const [rating,setRating]=useState('5'),[body,setBody]=useState(''),[busy,setBusy]=useState(false);
 const [notice,setNotice]=useState(''),[error,setError]=useState('');
 async function load(){
  const r=await fetch('/api/public/hotels/'+encodeURIComponent(slug)+'/reviews',{cache:'no-store'});
  const d=await r.json();
  if(!r.ok)throw Error(d.error||'Reviews unavailable.');
  setData(d);
  if(d.ownReview){setRating(String(d.ownReview.rating));setBody(d.ownReview.reviewText)}
 }
 useEffect(()=>{
  let live=true;setData(null);setGoogle(null);setError('');
  const base='/api/public/hotels/'+encodeURIComponent(slug);
  fetch(base+'/reviews',{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Reviews unavailable');if(live){setData(d);if(d.ownReview){setRating(String(d.ownReview.rating));setBody(d.ownReview.reviewText)}}})
   .catch(e=>{if(live)setError(e instanceof Error?e.message:'Reviews unavailable')});
  fetch(base+'/google',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(d=>{if(live)setGoogle(d)}).catch(()=>{});
  return()=>{live=false};
 },[slug]);
 async function submit(e:FormEvent){
  e.preventDefault();setBusy(true);setError('');setNotice('');
  try{
   const r=await fetch('/api/public/hotels/'+encodeURIComponent(slug)+'/reviews',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rating:Number(rating),reviewText:body}),cache:'no-store'
   });
   const response=await r.json().catch(()=>({}));
   if(!r.ok)throw Error(response.error||'Unable to save review.');
   await load();setNotice('Your Crystal Inn website review is now visible on this hotel page.');
  }catch(e){setError(e instanceof Error?e.message:'Unable to save review.')}finally{setBusy(false)}
 }
 return <div className="ci-reviews-wrap">
  <p className="ci-eyebrow">GUEST EXPERIENCE</p><h2>Reviews for this hotel</h2>
  <p>Google Maps reviews and Crystal Inn website reviews are separate. Ratings are not combined.</p>
  <div className="ci-review-sources">
   <div className="ci-review-score">
    <strong>Google Maps</strong>
    {google?.connected&&google.rating!=null?<><span className="ci-review-number">{google.rating.toFixed(1)} ★</span>
     <small>{google.userRatingCount??0} Google ratings · Source: Google Maps</small></>:
     <p>Google rating not yet available.</p>}
    {google?.reviewsUrl&&<a href={google.reviewsUrl} target="_blank" rel="noopener noreferrer">Read reviews on Google Maps ↗</a>}
    {google?.writeReviewUrl?<a className="ci-review-google-button" href={google.writeReviewUrl} target="_blank" rel="noopener noreferrer">Rate on Google ↗</a>:<small>Google review link not configured for this hotel.</small>}
   </div>
   <div className="ci-review-score">
    <strong>Crystal Inn website reviews</strong>
    {data?.summary.count?<><span className="ci-review-number">{Number(data.summary.average).toFixed(1)} ★</span>
     <small>{data.summary.count} first-party {data.summary.count===1?'review':'reviews'}</small></>:<p>No Crystal Inn website reviews yet.</p>}
    <small>Reviews written by SMS-verified hotel accounts, not necessarily verified stays.</small>
   </div>
  </div>
  {data?.canReview?<form className="ci-review-form" onSubmit={submit}>
    <h3>{data.ownReview?'Update your hotel review':'Write a Crystal Inn review'}</h3>
    {data.ownReview?.status==='hidden'?<p>Your earlier review is under moderation. Contact the hotel for assistance.</p>:<>
     <label>Your rating<select value={rating} onChange={e=>setRating(e.target.value)} required>
      {[5,4,3,2,1].map(n=><option key={n} value={n}>{n} {n===1?'star':'stars'}</option>)}
     </select></label>
     <label>Your experience<textarea minLength={10} maxLength={1200} required rows={5}
      placeholder="Tell other guests what you thought of your stay…" value={body} onChange={e=>setBody(e.target.value)}/></label>
     <small>One website review per verified account for this hotel. You may update it. Please avoid sharing personal information.</small>
     <button type="submit" disabled={busy}>{busy?'Saving…':data.ownReview?'Update review':'Post review'}</button>
    </>}
   </form>:<p className="ci-review-signin">
     To leave a Crystal Inn website review, <a href={'/guest/login?hotel='+encodeURIComponent(slug)}>sign in with SMS for this hotel</a>.
     A login for a different hotel cannot post here.
   </p>}
  {notice&&<p role="status" className="ci-review-notice">{notice}</p>}
  {error&&<p role="alert" className="ci-review-error">{error}</p>}
  <h3 className="ci-review-heading">Crystal Inn guest feedback</h3>
  {data?.reviews.length?<div className="ci-review-list">{data.reviews.map((r,i)=><article key={r.created_at+'-'+i}>
   <strong>{'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}</strong><small>SMS-verified guest · {r.created_at.slice(0,10)}</small>
   <p>{r.review_text}</p>
  </article>)}</div>:<p>No published website reviews for this hotel yet.</p>}
 </div>;
}
