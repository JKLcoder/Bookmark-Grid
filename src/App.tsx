import { useEffect, useRef, useState, type ReactNode } from 'react';
import { loadBookmarks, saveName, subscribe } from './api';
import { displayName, domain, searchBookmarks, sortBookmarks, type Bookmark } from './bookmarks';

function Modal({title,onClose,children,busy=false}:{title:string;onClose:()=>void;children:ReactNode;busy?:boolean}) {
 const ref = useRef<HTMLDialogElement>(null);
 useEffect(()=>{ref.current?.showModal();},[]);
 return <dialog ref={ref} aria-label={title} onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>
  <div className="dialog-heading"><h2>{title}</h2><button className="icon-button" aria-label="关闭" onClick={onClose} disabled={busy}>×</button></div>{children}
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
   <p className="original">{bookmark.url}</p>
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
 const refreshRef=useRef<()=>void>(()=>{});
 useEffect(()=>{
  let active=true;let revision=0;
  async function refresh(){
   const current=++revision;
   try {const data=await loadBookmarks();if(active&&current===revision){setBookmarks(data);setError('');}}
   catch(error){if(active&&current===revision)setError(error instanceof Error?error.message:'读取书签失败，请重试。');}
   finally{if(active&&current===revision)setLoading(false);}
  }
  refreshRef.current=()=>void refresh();
  let unsubscribe=()=>{};
  try {unsubscribe=subscribe(()=>void refresh());} catch {/* loadBookmarks supplies the user-facing API error. */}
  void refresh();
  return ()=>{active=false;revision++;unsubscribe();};
 },[]);
 const visible=sortBookmarks(searchBookmarks(bookmarks,query));
 return <main>
  <header><div className="brand"><span className="brand-mark" aria-hidden="true">▦</span><h1>Bookmark Grid</h1><span className="brand-subtitle">你的书签，一目了然。</span></div><button className="settings-button" onClick={()=>setSettings(true)} aria-label="设置">设置 <span aria-hidden="true">⚙</span></button></header>
  <section className="workspace" aria-label="书签">
   <div className="intro"><p className="eyebrow">ALL YOUR BOOKMARKS, ONE PLACE</p><h2>从这里，开始探索。</h2></div>
   <div className="search-wrap"><span aria-hidden="true" className="search-icon">⌕</span><label className="sr-only" htmlFor="search">搜索书签</label><input id="search" type="search" placeholder="搜索名称、网址或文件夹…" value={query} onChange={event=>setQuery(event.target.value)} autoComplete="off"/>{query&&<button onClick={()=>setQuery('')} className="icon-button" aria-label="清空搜索">×</button>}</div>
   <div className="info" aria-live="polite"><span>{loading?'正在读取书签…':query.trim()?`${visible.length} / ${bookmarks.length} 个书签`:`${bookmarks.length} 个书签`}</span><span>按显示名称排序 · 中文拼音 A–Z</span></div>
   {error&&<div role="alert" className="error-banner"><span>{error}</span><button onClick={()=>refreshRef.current()}>重试</button></div>}
   {!loading&&!error&&bookmarks.length===0&&<div className="empty"><span aria-hidden="true">▱</span><h3>还没有书签</h3><p>在 Chrome 中收藏一个网页，它就会出现在这里。</p><p>按 Ctrl / ⌘ + D 收藏当前网页。</p></div>}
   {!loading&&!error&&bookmarks.length>0&&visible.length===0&&<div className="empty"><h3>没有找到匹配的书签</h3><p>试试其他名称、域名或文件夹路径。</p><button onClick={()=>setQuery('')}>清空搜索</button></div>}
   <ul className="bookmark-grid">{visible.map(bookmark=><li key={bookmark.id} className="bookmark-item"><a href={bookmark.url} title={`${displayName(bookmark)}\n${bookmark.url}\n${bookmark.folderPath.join(' / ')}`}><span className="item-name">{displayName(bookmark)}</span><span className="item-domain">{domain(bookmark.url)}</span></a><button className="edit-button" aria-label={`编辑 ${displayName(bookmark)}`} onClick={()=>setEditing(bookmark)} title="编辑显示名称">✎</button></li>)}</ul>
   <footer><span className="status-dot"/>本地书签 · 自动同步<span className="footer-note">名称由你定义，数据留在本地。</span></footer>
  </section>
  {editing&&<Rename key={editing.id} bookmark={editing} onClose={()=>setEditing(null)} onSaved={()=>refreshRef.current()}/>}
  {settings&&<Modal title="设置与隐私" onClose={()=>setSettings(false)}><p>所有书签自动扁平展示，按显示名称的中文拼音排序。</p><p>悬停书签或用 Tab 聚焦即可编辑名称；留空或选择“恢复原标题”可移除自定义名称。</p><p>自定义名称仅保存在 chrome.storage.local，不同步到云端。不修改或删除 Chrome 原始书签，不发送书签数据。</p><p className="muted">默认在当前标签页打开。Ctrl / ⌘ + 点击或中键点击可保留浏览器原生的新标签页行为。</p><div className="dialog-actions"><span/><button className="primary" onClick={()=>setSettings(false)}>知道了</button></div></Modal>}
 </main>;
}
