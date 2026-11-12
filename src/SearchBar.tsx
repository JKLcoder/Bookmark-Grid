import {useRef} from 'react';
import {Cross2Icon,MagnifyingGlassIcon} from '@radix-ui/react-icons';
export type SearchMode='engine'|'bookmarks';
interface Props {mode:SearchMode;query:string;onModeChange:(mode:SearchMode)=>void;onQueryChange:(query:string)=>void;onSubmit:()=>void;busy:boolean;error:string}
export default function SearchBar({mode,query,onModeChange,onQueryChange,onSubmit,busy,error}:Props){
 const composing=useRef(false);
 return <div>
  <form className="search-wrap" role="search" aria-label={mode==='engine'?'引擎搜索':'书签搜索'} onSubmit={event=>{event.preventDefault();if(mode==='engine'&&query.trim()&&!composing.current&&!busy)onSubmit();}}>
   <label className="sr-only" htmlFor="search-mode">搜索模式</label>
   <select id="search-mode" className="search-mode" value={mode} onChange={event=>onModeChange(event.target.value as SearchMode)}><option value="engine">引擎</option><option value="bookmarks">书签</option></select>
   <MagnifyingGlassIcon aria-hidden="true" className="search-icon"/>
   <label className="sr-only" htmlFor="search">{mode==='engine'?'搜索互联网':'搜索书签'}</label>
   <input id="search" type="search" placeholder={mode==='engine'?'使用默认搜索引擎，按 Enter 搜索…':'搜索名称、网址或文件夹…'} value={query} onChange={event=>onQueryChange(event.target.value)} autoComplete="off" aria-describedby={error?'engine-search-error':undefined} onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={()=>{composing.current=false;}} onKeyDown={event=>{if(event.key==='Enter'&&(composing.current||event.nativeEvent.isComposing||event.keyCode===229))event.preventDefault();}}/>
   {query&&<button type="button" onClick={()=>onQueryChange('')} className="icon-button" aria-label="清空搜索"><Cross2Icon/></button>}
   <button className="sr-only" type="submit" tabIndex={-1} disabled={busy||mode!=='engine'}>提交搜索</button>
  </form>
  {error&&<div role="alert" id="engine-search-error" className="error-banner"><span>{error}</span><button type="button" disabled={busy} onClick={onSubmit}>重试搜索</button></div>}
 </div>;
}
