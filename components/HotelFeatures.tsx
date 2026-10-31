import {HOTEL_FEATURES,emptyFeatures,type FeatureFlags} from '../lib/hotel-features';
import './hotel-extras.css';
export default function HotelFeatures({features,all=false}:{features?:Partial<FeatureFlags>|null;all?:boolean}){
 const flags=features||emptyFeatures();
 const list=all?HOTEL_FEATURES:HOTEL_FEATURES.slice(0,4);
 return <div className="ci-feature-list" aria-label="Hotel amenities and services">
  {list.map(f=>{
   const enabled=flags[f.key]===true;
   return <div key={f.key} className={'ci-feature-row'+(enabled?' is-offered':'')}>
    <span aria-label={enabled?'Available':'Not listed'} className="ci-feature-check">{enabled?'✓':''}</span>
    <span>{f.label}</span><span className="ci-feature-accessible">{enabled?'Offered':'Not listed as offered'}</span>
   </div>;
  })}
 </div>;
}
