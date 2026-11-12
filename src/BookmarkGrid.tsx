import {useEffect,useRef,useState,type CSSProperties} from 'react';
import Favicon from './Favicon';
import {Pencil1Icon,DrawingPinIcon,DrawingPinFilledIcon} from '@radix-ui/react-icons';
import {displayName,type Bookmark} from './bookmarks';
import type {UsageMap} from './usage';
import {resolveColumns,type Layout} from './layout';
export default function BookmarkGrid({bookmarks,layout,onEdit,usage,onOpen,onPin}:{bookmarks:Bookmark[];layout:Layout;onEdit:(b:Bookmark)=>void;usage:UsageMap;onOpen:(id:string)=>void;onPin:(id:string,pinned:boolean)=>void}){
 const ref=useRef<HTMLUListElement>(null);const [width,setWidth]=useState(window.innerWidth-48);
 useEffect(()=>{
  const measure=()=>{if(ref.current)setWidth(ref.current.getBoundingClientRect().width||window.innerWidth-48);};measure();
  const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(measure);if(ref.current)observer?.observe(ref.current);
  window.addEventListener('resize',measure);return ()=>{observer?.disconnect();window.removeEventListener('resize',measure);};
 },[]);
 return <ul ref={ref} className="bookmark-grid" style={{gridTemplateColumns:`repeat(${resolveColumns(layout.columns,width,layout.columnGap)}, minmax(0, 1fr))`,rowGap:layout.rowGap,columnGap:layout.columnGap,'--item-size':`${layout.itemSize}px`} as CSSProperties}>{bookmarks.map(bookmark=><li key={bookmark.id} className={`bookmark-item${usage[bookmark.id]?.pinned?' is-pinned':''}`}><a href={bookmark.url} target={layout.openInNewTab?'_blank':undefined} rel={layout.openInNewTab?'noopener noreferrer':undefined} onClick={event=>{if(event.button===0)onOpen(bookmark.id);}} onAuxClick={event=>{if(event.button===1)onOpen(bookmark.id);}} title={`${displayName(bookmark)}\n${bookmark.folderPath.join(' / ')}`}><Favicon key={bookmark.url} url={bookmark.url} size={layout.itemSize}/><span className="item-name">{displayName(bookmark)}</span></a><button className="pin-button" aria-pressed={usage[bookmark.id]?.pinned===true} aria-label={`${usage[bookmark.id]?.pinned?'取消置顶':'置顶'} ${displayName(bookmark)}`} title={usage[bookmark.id]?.pinned?'取消置顶':'置顶'} onClick={()=>onPin(bookmark.id,!usage[bookmark.id]?.pinned)}>{usage[bookmark.id]?.pinned?<DrawingPinFilledIcon/>:<DrawingPinIcon/>}</button><button className="edit-button" aria-label={`编辑 ${displayName(bookmark)}`} onClick={()=>onEdit(bookmark)} title="编辑显示名称"><Pencil1Icon/></button></li>)}</ul>;
}
