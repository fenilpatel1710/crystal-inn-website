import './globals.css';
import type {Metadata} from 'next';

const brandName='Crystal Inn Hotels & Stays';
const description='Discover Crystal Inn hotels and stays. Explore our locations, rooms, amenities and guest services, and request your stay.';

// Brand-first homepage metadata; property-specific content remains on its own routes.
export const metadata:Metadata={
 metadataBase:new URL('https://crystalinnstay.com'),
 applicationName:brandName,
 title:{default:brandName,template:'%s | '+brandName},
 description,
 openGraph:{type:'website',siteName:brandName,title:brandName,description},
 icons:{
  icon:[{url:'/favicon.ico',type:'image/x-icon',sizes:'48x48'}],
  shortcut:'/favicon.ico'
 }
};

const websiteStructuredData={
 '@context':'https://schema.org',
 '@type':'WebSite',
 '@id':'https://crystalinnstay.com/#website',
 url:'https://crystalinnstay.com/',
 name:brandName,
 alternateName:'Crystal Inn',
 description
};

export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="en">
  <head>
   <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(websiteStructuredData)}}/>
  </head>
  <body>{children}</body>
 </html>;
}
