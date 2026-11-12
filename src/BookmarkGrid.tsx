import {useEffect,useRef,useState,type CSSProperties} from 'react';
import Favicon from './Favicon';
import {Pencil1Icon} from '@radix-ui/react-icons';
import {displayName,type Bookmark} from './bookmarks';
import {resolveColumns,type Layout} from './layout';
export default function BookmarkGrid({bookmarks,layout,onEdit}:{bookmarks:Bookmark[];layout:Layout;onEdit:(b:Bookmark)=>void}){
 const ref=useRef<HTMLUListElement>(null);const [width,setWidth]=useState(window.innerWidth-48);
 useEffect(()=>{
  const measure=()=>{if(ref.current)setWidth(ref.current.getBoundingClientRect().width||window.innerWidth-48);};measure();
  const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(measure);if(ref.current)observer?.observe(ref.current);
  window.addEventListener('resize',measure);return ()=>{observer?.disconnect();window.removeEventListener('resize',measure);};
 },[]);
 return <ul ref={ref} className="bookmark-grid" style={{gridTemplateColumns:`repeat(${resolveColumns(layout.columns,width,layout.columnGap)}, minmax(0, 1fr))`,rowGap:layout.rowGap,columnGap:layout.columnGap,'--item-size':`${layout.itemSize}px`} as CSSProperties}>{bookmarks.map(bookmark=><li key={bookmark.id} className="bookmark-item"><a href={bookmark.url} title={`${displayName(bookmark)}\n${bookmark.folderPath.join(' / ')}`}><Favicon key={bookmark.url} url={bookmark.url} size={layout.itemSize}/><span className="item-name">{displayName(bookmark)}</span></a><button className="edit-button" aria-label={`编辑 ${displayName(bookmark)}`} onClick={()=>onEdit(bookmark)} title="编辑显示名称"><Pencil1Icon/></button></li>)}</ul>;
}
