import {createSyncStore} from './sync-store.js';
/** @typedef {{count:number,lastOpened:number,pinned:boolean}} Usage */
/** @param {unknown} value @returns {Usage} */
function normalize(value) {
 const raw = value && typeof value === 'object' ? value : {};
 const number = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(Number.MAX_SAFE_INTEGER, Math.floor(v)) : 0;
 return {count:number(raw.count),lastOpened:number(raw.lastOpened),pinned:raw.pinned === true};
}
/** One worker owns all usage writes, including pinning and deletion. */
export function createUsageStore(api, sync = createSyncStore(api)) {
 let tail = Promise.resolve();
 const removed = new Set();
 /** @template T @param {()=>Promise<T>} work @returns {Promise<T>} */
 function enqueue(work) {
  const result = tail.then(work);
  tail = result.then(()=>{},()=>{});
  return result;
 }
 async function exists(id) {
  if (typeof id !== 'string' || !id || removed.has(id)) throw Error('书签已被删除或无效。');
  const nodes = await api.bookmarks.get(id);
  if (!nodes[0]?.url || removed.has(id)) throw Error('书签已被删除或无效。');
  return nodes[0];
 }
 function mutate(id, update) {
  return enqueue(async()=>{
   await exists(id);
   await sync.ready();
   const key = `usage:${id}`;
   const stored = await api.storage.local.get(key);
   if (removed.has(id)) throw Error('书签已被删除。');
   const next = update(normalize(stored[key]));
   await api.storage.local.set({[key]:next});
   return {...next,pinned:await sync.getPinned(id)};
  });
 }
 return {
  load:()=>enqueue(async()=>{
   await sync.mirror();
   const stored = await api.storage.local.get(null);
   const tree = await api.bookmarks.getTree();
   const ids = new Set();
   const visit = nodes => {for (const node of nodes) {if (node.url) ids.add(node.id); if (node.children) visit(node.children);}};
   visit(tree);
   const stale = Object.keys(stored).filter(key => /^(usage:|name:)/.test(key) && !ids.has(key.slice(key.indexOf(':')+1)));
   if (stale.length) await api.storage.local.remove(stale);
   const pins=await sync.pins();
   const result=Object.fromEntries(Object.entries(stored).filter(([key])=>key.startsWith('usage:')&&ids.has(key.slice(6))&&!removed.has(key.slice(6))).map(([key,value])=>[key.slice(6),{...normalize(value),pinned:pins.get(key.slice(6))===true}]));
   for(const [id,pinned] of pins)if(pinned&&!result[id])result[id]={count:0,lastOpened:0,pinned:true};
   return result;
  }),
  record:id=>mutate(id,usage=>({...usage,count:Math.min(Number.MAX_SAFE_INTEGER,usage.count+1),lastOpened:Date.now()})),
  setPinned:(id,pinned)=>enqueue(async()=>{await exists(id);await sync.setPinned(id,pinned);const stored=await api.storage.local.get('usage:'+id);return {...normalize(stored['usage:'+id]),pinned};}),
  remove:ids=>{
   ids.forEach(id=>removed.add(id));
   return enqueue(()=>api.storage.local.remove(ids.flatMap(id=>[`name:${id}`,`usage:${id}`])));
  }
 };
}
