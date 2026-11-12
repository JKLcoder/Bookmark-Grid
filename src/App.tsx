import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Cross2Icon, GearIcon, MagnifyingGlassIcon } from '@radix-ui/react-icons';
import BookmarkGrid from './BookmarkGrid';
import LayoutSettings from './LayoutSettings';
import { DEFAULT_LAYOUT, loadLayout, type Layout } from './layout';
import {loadUsage,recordOpen,setPinned,type UsageMap} from './usage';
import {rankBookmarks} from './ranking';
import { loadBookmarks, saveName, subscribe } from './api';
import { searchBookmarks, type Bookmark } from './bookmarks';

function Modal({title,onClose,children,busy=false}:{title:string;onClose:()=>void;children:ReactNode;busy?:boolean}) {
 const ref = useRef<HTMLDialogElement>(null);
 useEffect(()=>{ref.current?.showModal();},[]);
 return <dialog ref={ref} aria-label={title} onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>
  <div className="dialog-heading"><h2>{title}</h2><button className="icon-button" aria-label="关闭" onClick={onClose} disabled={busy}><Cross2Icon/></button></div>{children}
 </dialog>;
}
function Rename({bookmark,onClose,onSaved}:{bookmark:Bookmark;onClose:()=>void;onSaved:()=>void}) {
 const [name,setName] = useState(bookmark.customName ?? bookmark.title);
 const [saving,setSaving] = useState(false); const [error,setError]=useState('');
 async function save(value:string) {
  setSaving(true);setError('');
  try {await saveName(bookmark.id,value);onSaved();onClose();}
  catch(error){setError(error instanceof Error ? error.message : '保存失败，请重试。');setSaving(false);}
 }
 return <Modal title="编辑显示名称" onClose={onClose} busy={saving}>
  <p className="muted">只修改此页的名称，Chrome 原始书签保持不变。</p>
  <form onSubmit={event=>{event.preventDefault();void save(name);}}>
   <label htmlFor="display-name">显示名称</label>
   <input id="display-name" value={name} onChange={event=>setName(event.target.value)} autoFocus disabled={saving}/>
   <p className="original">原标题：{bookmark.title || '（无标题）'}</p>
   <p className="muted">留空可恢复原标题。</p>
   {error && <p role="alert" className="error">{error}</p>}
   <div className="dialog-actions"><button type="button" onClick={()=>void save('')} disabled={saving}>恢复原标题</button><span/><button type="button" onClick={onClose} disabled={saving}>取消</button><button className="primary" disabled={saving} type="submit">{saving?'保存中…':'保存名称'}</button></div>
  </form>
 </Modal>;
}
export default function App() {
 const [bookmarks,setBookmarks]=useState<Bookmark[]>([]);
 const [query,setQuery]=useState('');const [loading,setLoading]=useState(true);const [error,setError]=useState('');
 const [editing,setEditing]=useState<Bookmark|null>(null);const [settings,setSettings]=useState(false);
 const [layout,setLayout]=useState<Layout>({...DEFAULT_LAYOUT});
 const [usage,setUsage]=useState<UsageMap>({});
 const [snapshot,setSnapshot]=useState<UsageMap>({});
 const initialUsage=useRef<UsageMap|null>(null);
 const [notice,setNotice]=useState('');
 const closeSettings=useCallback(()=>setSettings(false),[]);
 const settingsOpen=useRef(settings);settingsOpen.current=settings;
 const refreshRef=useRef<()=>void>(()=>{});
 useEffect(()=>{
  let active=true;let revision=0;
  async function refresh(){
   const current=++revision;
   try {const [data,savedLayout]=await Promise.all([loadBookmarks(),loadLayout()]);if(active&&current===revision){setBookmarks(data);if(!settingsOpen.current)setLayout(savedLayout);setError('');}
    try {const latest=await loadUsage();if(active&&current===revision){setUsage(latest);setNotice('');if(initialUsage.current===null){initialUsage.current=latest;setSnapshot(latest);}}}
    catch(error){if(active&&current===revision)setNotice(`本地使用数据读取失败：${error instanceof Error?error.message:'请重试'}`);}
   }
   catch(error){if(active&&current===revision)setError(error instanceof Error?error.message:'读取书签失败，请重试。');}
   finally{if(active&&current===revision)setLoading(false);}
  }
  refreshRef.current=()=>void refresh();
  let unsubscribe=()=>{};
  try {unsubscribe=subscribe(()=>void refresh());} catch {/* loadBookmarks supplies the user-facing API error. */}
  void refresh();
  return ()=>{active=false;revision++;unsubscribe();};
 },[]);
 const visible=rankBookmarks(searchBookmarks(bookmarks,query),snapshot,usage);
 function opened(id:string){void recordOpen(id).catch(error=>setNotice(`使用记录保存失败：${error instanceof Error?error.message:'请重试'}`));}
 async function pin(id:string,pinned:boolean){
  try {await setPinned(id,pinned);setUsage(previous=>({...previous,[id]:{count:previous[id]?.count??0,lastOpened:previous[id]?.lastOpened??0,pinned}}));}
  catch(error){setNotice(`置顶保存失败：${error instanceof Error?error.message:'请重试'}`);}
 }
 return <main>
  <header><h1>Bookmark Grid</h1><button className="settings-button" onClick={()=>setSettings(value=>!value)} aria-label="设置" aria-expanded={settings} aria-controls="layout-settings">设置 <GearIcon/></button></header>
  <section className="workspace" aria-label="书签">
   <div className="search-wrap"><MagnifyingGlassIcon aria-hidden="true" className="search-icon"/><label className="sr-only" htmlFor="search">搜索书签</label><input id="search" type="search" placeholder="搜索名称、网址或文件夹…" value={query} onChange={event=>setQuery(event.target.value)} autoComplete="off"/>{query&&<button onClick={()=>setQuery('')} className="icon-button" aria-label="清空搜索"><Cross2Icon/></button>}</div>
   <div className="info" aria-live="polite"><span>{loading?'正在读取书签…':query.trim()?`${visible.length} / ${bookmarks.length} 个书签`:`${bookmarks.length} 个书签`}</span><span>置顶优先 · 按使用频率排序</span></div>
   {error&&<div role="alert" className="error-banner"><span>{error}</span><button onClick={()=>refreshRef.current()}>重试</button></div>}
   {notice&&<div role="alert" className="error-banner"><span>{notice}</span><button onClick={()=>refreshRef.current()}>重试</button></div>}
   {!loading&&!error&&bookmarks.length===0&&<div className="empty"><h3>还没有书签</h3><p>在 Chrome 中收藏一个网页，它就会出现在这里。</p><p>按 Ctrl / ⌘ + D 收藏当前网页。</p></div>}
   {!loading&&!error&&bookmarks.length>0&&visible.length===0&&<div className="empty"><h3>没有找到匹配的书签</h3><p>试试其他名称、域名或文件夹路径。</p><button onClick={()=>setQuery('')}>清空搜索</button></div>}
   <BookmarkGrid bookmarks={visible} layout={layout} onEdit={setEditing} usage={usage} onOpen={opened} onPin={(id,pinned)=>void pin(id,pinned)}/>
   <footer>本地存储 · 不上传书签</footer>
  </section>
  {editing&&<Rename key={editing.id} bookmark={editing} onClose={()=>setEditing(null)} onSaved={()=>refreshRef.current()}/>}
  {settings&&<LayoutSettings layout={layout} onChange={setLayout} onClose={closeSettings}/>}

 </main>;
}
