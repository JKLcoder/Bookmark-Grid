import {useState} from 'react';
import {GlobeIcon} from '@radix-ui/react-icons';
// Chrome serves the icon through its own favicon database, never a third-party service.
export function faviconUrl(pageUrl:string,size:number):string|null {
 try {
  const page=new URL(pageUrl);
  if(!['http:','https:'].includes(page.protocol)||!globalThis.chrome?.runtime?.getURL)return null;
  const endpoint=new URL(chrome.runtime.getURL('_favicon/'));
  endpoint.searchParams.set('pageUrl',pageUrl);
  endpoint.searchParams.set('size',String(size*2));
  return endpoint.href;
 }catch{return null;}
}
export default function Favicon({url,size}:{url:string;size:number}) {
 const [failed,setFailed]=useState(false);
 const src=faviconUrl(url,size);
 return <span className="bookmark-favicon" aria-hidden="true">{src&&!failed?<img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>:<GlobeIcon/>}</span>;
}
