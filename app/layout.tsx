import './globals.css';
import type {Metadata} from 'next';

// Site-wide identity: platform brand, never a specific hotel's name in the browser tab.
// Per-property pages can add hotel-specific titles later using route metadata.
export const metadata:Metadata={
 title:{default:'Crystal Inn Hotels & Stays',template:'%s | Crystal Inn Hotels & Stays'},
 description:'Find Crystal Inn hotels and stays. Explore locations, rooms, guest services, and request your stay.',
 icons:{icon:[{url:'/icon.svg',type:'image/svg+xml'}],shortcut:'/icon.svg'}
};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
