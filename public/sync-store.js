// Shared by the MV3 worker and deterministic multi-device tests. No network API.
export const SYNC_DATABASE = 'sync:database:v1';
export const SYNC_STATUS = 'sync:status';
const PREFIX = 'bg2:';
const fields = ['columns','rowGap','columnGap','itemSize','searchEngine','openInNewTab'];
const clone = value => structuredClone(value);
const bytes = value => new TextEncoder().encode(value).length;
const ordered = value => Array.isArray(value)?value.map(ordered):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,ordered(value[key])])):value;
const same = (a,b) => JSON.stringify(ordered(a)) === JSON.stringify(ordered(b));
function validSetting(field,value) {
 if(field==='columns'&&value==='auto')return true;
 if(field==='searchEngine')return ['browser','baidu','google'].includes(value);
 if(field==='openInNewTab')return typeof value==='boolean';
 const bounds={columns:[1,12],rowGap:[0,32],columnGap:[0,48],itemSize:[12,28]}[field];
 return !!bounds&&Number.isInteger(value)&&value>=bounds[0]&&value<=bounds[1];
}
function version(value) {
 if(typeof value!=='string'||!/^\w+-[a-f0-9]{12}$/.test(value))return null;
 const time=parseInt(value.split('-')[0],36);
 return Number.isSafeInteger(time)&&time>=0?time:null;
}
function newer(a,b) { return !b || version(a[1])>version(b[1]) || (version(a[1])===version(b[1])&&a[1]>b[1]); }
function validCell(bucket,record,field,cell) {
 if(!Array.isArray(cell)||cell.length!==2||version(cell[1])===null)return false;
 if(bucket===PREFIX+'settings')return record==='layout'&&fields.includes(field)&&validSetting(field,cell[0]);
 return /^bg2:[a-f0-9]{2}$/.test(bucket)&&/^[A-Za-z0-9_-]{43}$/.test(record)&&
  ((field==='n'&&(cell[0]===null||typeof cell[0]==='string'))||(field==='p'&&typeof cell[0]==='boolean'));
}
function sanitized(raw,strict=false) {
 const result={};
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('设置文件格式无效。');
 for(const [bucket,records] of Object.entries(raw)) {
  if(!records||typeof records!=='object'||Array.isArray(records)){if(strict)throw Error('设置文件数据无效。');continue;}
  for(const [record,cells] of Object.entries(records)) {
   if(!cells||typeof cells!=='object'||Array.isArray(cells)){if(strict)throw Error('设置文件数据无效。');continue;}
   for(const [field,cell] of Object.entries(cells)) {
    if(!validCell(bucket,record,field,cell)){if(strict)throw Error('设置文件包含无效字段。');continue;}
    result[bucket]??={};result[bucket][record]??={};result[bucket][record][field]=clone(cell);
   }
  }
 }
 return result;
}
function flatten(nodes) { return nodes.flatMap(n=>n.url!==undefined?[n]:flatten(n.children??[])); }

export function createSyncStore(api) {
 let db;let initialized=false;let tail=Promise.resolve();let saved='';let lastStatus='';
 const identities=new Map();
 /** @template T @param {()=>Promise<T>} work @returns {Promise<T>} */
 function enqueue(work){const result=tail.then(work);tail=result.catch(()=>{});return result;}
 async function identity(url) {
  // The entire Chrome URL string is significant, including path, query and fragment.
  if(!identities.has(url))identities.set(url,crypto.subtle.digest('SHA-256',new TextEncoder().encode(url)).then(buffer=>{
   const raw=new Uint8Array(buffer);return {bucket:PREFIX+raw[0].toString(16).padStart(2,'0'),record:btoa(String.fromCharCode(...raw)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')};
  }));
  return identities.get(url);
 }
 function stamp(){db.clock=Math.max(Date.now(),db.clock+1);return db.clock.toString(36)+'-'+db.device;}
 function put(bucket,record,field,value,fresh=false,legacy=false) {
  db.buckets[bucket]??={};db.buckets[bucket][record]??={};
  const current=db.buckets[bucket][record][field];
  if(!fresh&&current&&same(current[0],value)&&(legacy||version(current[1])>0))return;
  db.buckets[bucket][record][field]=[value,legacy?'0-'+db.device:stamp()];
  if(legacy){db.legacyPending??={};db.legacyPending[bucket+'/'+record+'/'+field]=db.buckets[bucket][record][field][1];}
  if(!db.pending.includes(bucket))db.pending.push(bucket);
 }
 async function persist(){const text=JSON.stringify(db);if(text!==saved){await api.storage.local.set({[SYNC_DATABASE]:clone(db)});saved=text;}}
 async function status(phase,error='') {
  const value={phase,error};const text=JSON.stringify(value);
  if(text!==lastStatus){await api.storage.local.set({[SYNC_STATUS]:value});lastStatus=text;}
  return value;
 }
 async function tree(){return flatten(await api.bookmarks.getTree());}
 async function projection() {
  const local=await api.storage.local.get(null);const patch={};const remove=[];
  db.provenance??={};const present=new Set();
  const layout=db.buckets[PREFIX+'settings']?.layout??{};
  for(const field of fields)if(layout[field]&&!same(local['layout:'+field],layout[field][0]))patch['layout:'+field]=layout[field][0];
  for(const node of await tree()) {
   const {bucket,record}=await identity(node.url);const name=db.buckets[bucket]?.[record]?.n;
   present.add(node.id);
   if(!name&&(db.migrated||(db.provenance[node.id]&&db.provenance[node.id]!==record))&&local['name:'+node.id]!==undefined)remove.push('name:'+node.id);
   db.provenance[node.id]=record;
   if(name){if(name[0]===null){if(local['name:'+node.id]!==undefined)remove.push('name:'+node.id);}else if(local['name:'+node.id]!==name[0])patch['name:'+node.id]=name[0];}
  }
  for(const id of Object.keys(db.provenance))if(!present.has(id))delete db.provenance[id];
  return {patch,remove};
 }
 async function mirrorNow() {
  const {patch,remove}=await projection();
  if(Object.keys(patch).length)await api.storage.local.set(patch);
  if(remove.length)await api.storage.local.remove(remove);
  await persist();
 }
 async function migrateLegacy() {
  if(db.migrated)return;
  const local=await api.storage.local.get(null);
  const layout=db.buckets[PREFIX+'settings']?.layout??{};
  for(const field of fields)if(!layout[field]&&validSetting(field,local['layout:'+field]))put(PREFIX+'settings','layout',field,local['layout:'+field],false,true);
  for(const node of await tree()) {
   const {bucket,record}=await identity(node.url);const current=db.buckets[bucket]?.[record]??{};
   const name=local['name:'+node.id];
   if(!current.n&&typeof name==='string'&&name.trim())put(bucket,record,'n',name.trim(),false,true);
   if(!current.p&&local['usage:'+node.id]?.pinned===true)put(bucket,record,'p',true,false,true);
  }
  db.migrated=true;
 }
 function preferCloudToUnpublishedLegacy(remote) {
  const clean=sanitized(remote);
  for(const [path,stamp] of Object.entries(db.legacyPending??{})) {
   const [bucket,record,field]=path.split('/');
   const current=db.buckets[bucket]?.[record]?.[field];const cloud=clean[bucket]?.[record]?.[field];
   if(!current||current[1]!==stamp){delete db.legacyPending[path];continue;}
   if(cloud){db.buckets[bucket][record][field]=clone(cloud);delete db.legacyPending[path];}
  }
 }
 function merge(remote) {
  for(const [bucket,records] of Object.entries(sanitized(remote)))for(const [record,cells] of Object.entries(records))for(const [field,cell] of Object.entries(cells)) {
   db.clock=Math.max(db.clock,version(cell[1]));
   db.buckets[bucket]??={};db.buckets[bucket][record]??={};
   if(newer(cell,db.buckets[bucket][record][field]))db.buckets[bucket][record][field]=clone(cell);
  }
 }
 function dirtyAgainst(remote) {
  db.pending=Object.keys(db.buckets).filter(key=>!same(db.buckets[key],sanitized({[key]:remote[key]})[key]));
 }
 async function remoteRead() {
  if(!api.storage.sync){await status('unavailable','此浏览器未提供 Chrome 同步存储。');return null;}
  try{return await api.storage.sync.get(null);}catch(error){await status('error',error instanceof Error?error.message:'暂时无法读取 Chrome 同步。');return null;}
 }
 async function initialize() {
  if(initialized)return;
  const local=await api.storage.local.get(null);const stored=local[SYNC_DATABASE];
  lastStatus=JSON.stringify(local[SYNC_STATUS]??null);
  db=stored?.version===1?clone(stored):{version:1,device:crypto.randomUUID().replaceAll('-','').slice(0,12),clock:0,buckets:{},pending:[],migrated:false};
  db.buckets=sanitized(db.buckets);db.pending=Array.isArray(db.pending)?db.pending:[];
  saved=stored?.version===1?JSON.stringify(stored):'';
  const remote=await remoteRead();
  if(remote){preferCloudToUnpublishedLegacy(remote);merge(remote);await migrateLegacy();dirtyAgainst(remote);}
  await persist();await mirrorNow();
  if(remote)await status(db.pending.length?'pending':'accepted');
  initialized=true;
 }
 async function edit(work) {
  await initialize();const previous=clone(db);
  try {
   await work();
   const {patch,remove}=await projection();
   const state={phase:api.storage.sync?'pending':'unavailable',error:api.storage.sync?'':'此浏览器未提供 Chrome 同步存储。'};
   // Commit the outbox and its UI mirror in one StorageArea.set operation.
   // Reset aliases use null in that commit so a later cleanup failure is harmless.
   for(const key of remove)patch[key]=null;
   await api.storage.local.set({...patch,[SYNC_DATABASE]:clone(db),[SYNC_STATUS]:state});
   saved=JSON.stringify(db);lastStatus=JSON.stringify(state);
   if(remove.length)try{await api.storage.local.remove(remove);}catch{/* null is already an effective reset. */}
  }catch(error){db=previous;throw error;}
 }
 async function nodeFor(id){const nodes=await api.bookmarks.get(id);if(nodes.length!==1||!nodes[0]?.url)throw Error('书签已被删除或无效。');return nodes[0];}
 async function flushNow() {
  await initialize();const remote=await remoteRead();if(!remote)return;
  preferCloudToUnpublishedLegacy(remote);merge(remote);await migrateLegacy();dirtyAgainst(remote);await persist();await mirrorNow();
  if(!db.pending.length){await status('accepted');return;}
  const patch=Object.fromEntries(db.pending.map(key=>[key,db.buckets[key]]));
  try {
   const full={...remote,...patch};
   if(Object.keys(full).length>512)throw Error('Chrome 同步项目已达上限，设置仍保存在本机。');
   for(const [key,value] of Object.entries(patch))if(bytes(key)+bytes(JSON.stringify(value))>8192)throw Error('单项设置超过 Chrome 同步容量，设置仍保存在本机。');
   if(Object.entries(full).reduce((sum,[key,value])=>sum+bytes(key)+bytes(JSON.stringify(value)),0)>102400)throw Error('Chrome 同步空间已满（100KB），设置仍保存在本机。');
   await api.storage.sync.set(patch);
   db.pending=[];db.legacyPending={};await persist();await status('accepted');
  }catch(error){await status('error',error instanceof Error?error.message:'同步未完成，请重试。');}
 }
 return {
  ready:()=>enqueue(initialize),
  mirror:()=>enqueue(async()=>{await initialize();await mirrorNow();}),
  setLayout:patch=>enqueue(()=>edit(async()=>{for(const [field,value] of Object.entries(patch)){if(!fields.includes(field)||!validSetting(field,value))throw Error('布局设置无效。');put(PREFIX+'settings','layout',field,value);}})),
  setName:(id,name)=>enqueue(async()=>{const node=await nodeFor(id);if(typeof name!=='string')throw Error('名称无效。');await edit(async()=>{const {bucket,record}=await identity(node.url);put(bucket,record,'n',name.trim()||null);});}),
  setPinned:(id,pinned)=>enqueue(async()=>{const node=await nodeFor(id);if(typeof pinned!=='boolean')throw Error('置顶设置无效。');await edit(async()=>{const {bucket,record}=await identity(node.url);put(bucket,record,'p',pinned);});}),
  getPinned:id=>enqueue(async()=>{const node=await nodeFor(id);await initialize();const {bucket,record}=await identity(node.url);const cell=db.buckets[bucket]?.[record]?.p;if(cell)return cell[0];const local=await api.storage.local.get(null);return !db.migrated&&local['usage:'+id]?.pinned===true;}),
  pins:()=>enqueue(async()=>{await initialize();const local=await api.storage.local.get(null);const result=new Map();for(const node of await tree()){const {bucket,record}=await identity(node.url);const cell=db.buckets[bucket]?.[record]?.p;result.set(node.id,cell?cell[0]:!db.migrated&&local['usage:'+node.id]?.pinned===true);}return result;}),
  flush:()=>enqueue(async()=>{try{await flushNow();}catch(error){await status('error',error instanceof Error?error.message:'同步未完成，请重试。');}}),
  receive:changes=>enqueue(async()=>{await initialize();const remote=Object.fromEntries(Object.entries(changes).filter(([key])=>key.startsWith(PREFIX)).map(([key,value])=>[key,value.newValue]));preferCloudToUnpublishedLegacy(remote);merge(remote);for(const key of Object.keys(remote))if(!same(db.buckets[key],sanitized({[key]:remote[key]})[key])&&!db.pending.includes(key))db.pending.push(key);await persist();await mirrorNow();if(db.pending.length)await status('pending');}),
  exportData:()=>enqueue(async()=>{await initialize();const previous=db;db=clone(db);try{await migrateLegacy();return {format:'bookmark-grid-settings',version:1,buckets:clone(db.buckets)};}finally{db=previous;}}),
  importData:data=>enqueue(async()=>{if(data?.format!=='bookmark-grid-settings'||data.version!==1)throw Error('请选择 Bookmark Grid 设置备份文件。');const buckets=sanitized(data.buckets,true);await edit(async()=>{for(const [bucket,records] of Object.entries(buckets))for(const [record,cells] of Object.entries(records))for(const [field,cell] of Object.entries(cells))put(bucket,record,field,cell[0],true);});}),
 };
}
