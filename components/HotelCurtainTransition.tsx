'use client';

import {createContext,useCallback,useContext,useEffect,useRef,useState,type AnchorHTMLAttributes,type MouseEvent,type ReactNode} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import './HotelCurtainTransition.css';

type Phase='idle'|'closing'|'closed'|'opening';
type CurtainContextValue={openHotel:(href:string)=>void};
const CurtainContext=createContext<CurtainContextValue|null>(null);

export function HotelCurtainProvider({children}:{children:ReactNode}){
 const router=useRouter();
 const pathname=usePathname();
 const [phase,setPhase]=useState<Phase>('idle');
 const pending=useRef<string|null>(null);
 const locked=useRef(false);
 const timers=useRef<ReturnType<typeof setTimeout>[]>([]);
 const clearTimers=useCallback(()=>{
  for(const timer of timers.current)window.clearTimeout(timer);
  timers.current=[];
 },[]);
 const queue=useCallback((fn:()=>void,ms:number)=>{
  const timer=window.setTimeout(fn,ms);
  timers.current.push(timer);
 },[]);
 const finish=useCallback(()=>{
  pending.current=null;
  locked.current=false;
  setPhase('opening');
  queue(()=>setPhase('idle'),870);
 },[queue]);
 useEffect(()=>{
  if(pending.current&&pathname===pending.current){
   clearTimers();
   finish();
  }
 },[pathname,clearTimers,finish]);
 useEffect(()=>()=>clearTimers(),[clearTimers]);

 const openHotel=useCallback((href:string)=>{
  if(locked.current)return;
  const destination=href.split(/[?#]/)[0];
  // Respect user settings; keyboard and modified link actions retain native behavior.
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){
   router.push(href);
   return;
  }
  if(pathname===destination){router.push(href);return}
  locked.current=true;
  pending.current=destination;
  setPhase('closing');
  queue(()=>{
   setPhase('closed');
   router.push(href);
  },700);
  // Never strand a guest behind closed curtains if navigation fails or stalls.
  queue(()=>{if(pending.current){clearTimers();finish()}},9000);
 },[pathname,router,queue,clearTimers,finish]);
 return <CurtainContext.Provider value={{openHotel}}>
  {children}
  <div className={'ci-curtain ci-curtain-'+phase} aria-hidden="true">
   <div className="ci-curtain-panel ci-curtain-left"/>
   <div className="ci-curtain-panel ci-curtain-right"/>
   <div className="ci-curtain-wordmark"><span>CRYSTAL INN</span><small>HOTELS & STAYS</small></div>
  </div>
  {phase!=='idle'&&<span className="ci-curtain-sr-only" role="status" aria-live="polite">Opening your selected Crystal Inn hotel</span>}
 </CurtainContext.Provider>;
}

type LinkProps=AnchorHTMLAttributes<HTMLAnchorElement>&{href:string};
export function HotelCurtainLink({href,onClick,children,...props}:LinkProps){
 const transition=useContext(CurtainContext);
 function handleClick(event:MouseEvent<HTMLAnchorElement>){
  onClick?.(event);
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||
     props.target==='_blank'||!transition||!href.startsWith('/hotels/'))return;
  event.preventDefault();
  transition.openHotel(href);
 }
 return <a {...props} href={href} onClick={handleClick}>{children}</a>;
}
