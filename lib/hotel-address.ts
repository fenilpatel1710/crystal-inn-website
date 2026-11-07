/**
 * Display a property's address without duplicating the city/state if the
 * address_text field already contains a fully-formatted mailing address.
 * Future hotels should save their full street address including ZIP.
 */
function escapeRegExp(value:string){
 return value.replace(/[.*+?^$\{\}()|[\]\\]/g,'\\$&');
}
export function fullHotelAddress(address:string,city:string,region:string,hotelIdentity=''):string{
 const street=address.trim().replace(/\s+/g,' ');
 if(!street)return '';
 const cityValue=city.trim();
 const regionValue=region.trim();
 const hasCity=cityValue?new RegExp('(?:^|,)\\s*'+escapeRegExp(cityValue)+'(?:\\s|,|$)','i').test(street):true;
 const hasRegion=regionValue?new RegExp('\\b'+escapeRegExp(regionValue)+'\\b','i').test(street):true;
 let result=street;
 if(!hasCity&&cityValue)result+=', '+cityValue;
 if(!hasRegion&&regionValue)result+=', '+regionValue;
 // The existing NW290 D1 profile stores just "6850 Gessner Rd".
 // Google Maps' published address for that exact site includes ZIP 77040.
 // Do not infer any other hotel's ZIP; they should save it in Hotel details.
 const isNW290=hotelIdentity==='northwest-290'||hotelIdentity==='crystal-inn-northwest-290';
 if(isNW290&&/^6850\s+Gessner\s+(?:Rd|Road)\.?\b/i.test(street)&&
   !/\b\d{5}(?:-\d{4})?\b/.test(result))result+=' 77040';
 return result;
}
