/** @typedef {{count:number,lastOpened:number,pinned:boolean}} Usage */
/** @param {unknown} value @returns {Usage} */
function normalize(value) {
 const raw = value && typeof value === 'object' ? value : {};
 const number = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(Number.MAX_SAFE_INTEGER, Math.floor(v)) : 0;
 return {count:number(raw.count),lastOpened:number(raw.lastOpened),pinned:raw.pinned === true};
}
/** One worker owns all usage writes, including pinning and deletion. */
export function createUsageStore(api) {
 let tail = Promise.resolve();
 const removed = new Set();
 function enqueue(work) {
  const result = tail.then(work);
  tail = result.then(()=>{},()=>{});
  return result;
 }
 async function exists(id) {
  if (typeof id !== 'string' || !id || removed.has(id)) throw Error('书签已被删除或无效。');
  const nodes = await api.bookmarks.get(id);
  if (!nodes[0]?.url || removed.has(id)) throw Error('书签已被删除或无效。');
 }
 function mutate(id, update) {
  return enqueue(async()=>{
   await exists(id);
   const key = `usage:${id}`;
   const stored = await api.storage.local.get(key);
   if (removed.has(id)) throw Error('书签已被删除。');
   const next = update(normalize(stored[key]));
   await api.storage.local.set({[key]:next});
   return next;
  });
 }
 return {
  load:()=>enqueue(async()=>{
   const stored = await api.storage.local.get(null);
   const tree = await api.bookmarks.getTree();
   const ids = new Set();
   const visit = nodes => {for (const node of nodes) {if (node.url) ids.add(node.id); if (node.children) visit(node.children);}};
   visit(tree);
   const stale = Object.keys(stored).filter(key => /^(usage:|name:)/.test(key) && !ids.has(key.slice(key.indexOf(':')+1)));
   if (stale.length) await api.storage.local.remove(stale);
   return Object.fromEntries(Object.entries(stored).filter(([key])=>key.startsWith('usage:')&&ids.has(key.slice(6))&&!removed.has(key.slice(6))).map(([key,value])=>[key.slice(6),normalize(value)]));
  }),
  record:id=>mutate(id,usage=>({...usage,count:Math.min(Number.MAX_SAFE_INTEGER,usage.count+1),lastOpened:Date.now()})),
  setPinned:(id,pinned)=>mutate(id,usage=>({...usage,pinned:pinned===true})),
  remove:ids=>{
   ids.forEach(id=>removed.add(id));
   return enqueue(()=>api.storage.local.remove(ids.flatMap(id=>[`name:${id}`,`usage:${id}`])));
  }
 };
}
