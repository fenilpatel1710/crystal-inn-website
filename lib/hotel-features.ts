export const HOTEL_FEATURES = [
 {key:'breakfast',label:'Breakfast'},
 {key:'rewards',label:'Rewards program'},
 {key:'wifi',label:'Wi-Fi'},
 {key:'parking',label:'Parking'},
 {key:'accessible_parking',label:'Accessible parking'},
 {key:'pet_friendly',label:'Pet-friendly'},
 {key:'pool',label:'Swimming pool'},
 {key:'fitness_center',label:'Fitness center'},
 {key:'guest_laundry',label:'Guest laundry'},
 {key:'business_center',label:'Business center'},
 {key:'ev_charging',label:'EV charging'},
 {key:'smoking_rooms',label:'Smoking rooms'},
 {key:'front_desk_24h',label:'24-hour front desk'}
] as const;
export type FeatureKey = typeof HOTEL_FEATURES[number]['key'];
export type FeatureFlags = Record<FeatureKey, boolean>;
export const emptyFeatures=():FeatureFlags=>
 Object.fromEntries(HOTEL_FEATURES.map(f=>[f.key,false])) as FeatureFlags;

type FeatureRow={feature_key:string;enabled:number};
export function mergedFeatures(rows:FeatureRow[],rewardsEnabled:number|null|undefined):FeatureFlags {
 const flags=emptyFeatures();
 flags.rewards=rewardsEnabled===1;
 for(const row of rows){
  if(row.feature_key!=='rewards'&&Object.prototype.hasOwnProperty.call(flags,row.feature_key)){
   flags[row.feature_key as FeatureKey]=row.enabled===1;
  }
 }
 return flags;
}
export function validGoogleReviewUrl(value:string){
 if(!value)return true;
 if(value.length>1500)return false;
 try{
  const u=new URL(value);
  return u.protocol==='https:'&&!u.username&&!u.password&&
    (u.hostname==='google.com'||u.hostname.endsWith('.google.com')||
     u.hostname==='maps.app.goo.gl'||u.hostname==='goo.gl');
 }catch{return false}
}
