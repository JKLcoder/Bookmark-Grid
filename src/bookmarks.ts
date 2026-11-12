export interface Bookmark { id: string; title: string; url: string; folderPath: string[]; customName?: string }
export interface TreeNode { id: string; title: string; url?: string; children?: TreeNode[] }
export function flattenBookmarks(nodes: TreeNode[], path: string[] = []): Bookmark[] {
 return nodes.flatMap(node => node.url !== undefined
  ? [{id:node.id,title:node.title,url:node.url,folderPath:path}]
  : flattenBookmarks(node.children ?? [], node.title ? [...path,node.title] : path));
}
export const displayName = (b: Bookmark): string => b.customName || b.title || b.url;
export function domain(url: string): string { try { return new URL(url).hostname || url; } catch { return url; } }
export function searchBookmarks(bookmarks: Bookmark[], query: string): Bookmark[] {
 const q = query.trim().normalize('NFKC').toLocaleLowerCase();
 return bookmarks.filter(b => [b.customName ?? '',b.title,b.url,domain(b.url),b.folderPath.join('/')].some(s=>s.normalize('NFKC').toLocaleLowerCase().includes(q)));
}
const collator = new Intl.Collator('zh-CN-u-co-pinyin', {numeric:true,sensitivity:'base'});
export const sortBookmarks = (b: Bookmark[]): Bookmark[] => [...b].sort((a,b)=>collator.compare(displayName(a),displayName(b)) || collator.compare(a.id,b.id));
export function pruneNames(names: Record<string,string>, bookmarks: Bookmark[]): Record<string,string> {
 const ids = new Set(bookmarks.map(b=>b.id));
 return Object.fromEntries(Object.entries(names).filter(([id])=>ids.has(id)));
}
