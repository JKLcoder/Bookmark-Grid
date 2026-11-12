import { flattenBookmarks, pruneNames, type Bookmark } from './bookmarks';
const prefix = 'name:';
function extension() {
 if (!globalThis.chrome?.bookmarks || !globalThis.chrome?.storage?.local) throw new Error('请在 Chrome 中加载此扩展，然后打开新标签页。');
 return chrome;
}
export async function loadBookmarks(): Promise<Bookmark[]> {
 const api = extension();
 // Capture stored keys first: a bookmark created during this read cannot lose its new alias.
 const stored = await api.storage.local.get(null);
 const bookmarks = flattenBookmarks(await api.bookmarks.getTree());
 const names = Object.fromEntries(Object.entries(stored).filter(([k,v])=>k.startsWith(prefix)&&typeof v==='string').map(([k,v])=>[k.slice(prefix.length),v as string]));
 const valid = pruneNames(names, bookmarks);
 const stale = Object.keys(names).filter(id=>!(id in valid)).map(id=>prefix+id);
 if (stale.length) await api.storage.local.remove(stale);
 return bookmarks.map(b=>({...b,customName:valid[b.id]}));
}
export async function saveName(id: string, name: string): Promise<void> {
 const api = extension(); const value = name.trim();
 // Per-ID keys avoid read/modify/write races between different new-tab pages.
 if (value) await api.storage.local.set({[prefix+id]:value});
 else await api.storage.local.remove(prefix+id);
}
export function subscribe(listener:()=>void): ()=>void {
 const api = extension();
 const events = [api.bookmarks.onCreated,api.bookmarks.onChanged,api.bookmarks.onMoved,api.bookmarks.onRemoved,api.storage.onChanged];
 events.forEach(event=>event.addListener(listener));
 return ()=>events.forEach(event=>event.removeListener(listener));
}
