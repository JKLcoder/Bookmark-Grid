import {it,expect} from 'vitest';
import {createSyncStore} from '../public/sync-store.js';
function device(cloud:Record<string,any>,id='a',initial:Record<string,any>={}) {
 const local=structuredClone(initial);let unavailable=false;let writes=0;
 let nodes=[{id,title:'文档',url:'https://example.test/docs?q=1#part'}];
 const api:any={bookmarks:{getTree:async()=>[{id:'0',children:nodes}],get:async(key:string)=>{const node=nodes.find(n=>n.id===key);if(!node)throw Error('missing');return [node];}},storage:{local:{get:async()=>structuredClone(local),set:async(patch:any)=>Object.assign(local,structuredClone(patch)),remove:async(keys:any)=>[keys].flat().forEach(k=>delete local[k])},sync:{get:async()=>{if(unavailable)throw Error('offline');return structuredClone(cloud);},set:async(patch:any)=>{if(unavailable)throw Error('offline');writes++;Object.assign(cloud,structuredClone(patch));}}}};
 return {api,local,store:createSyncStore(api),offline:(v=true)=>unavailable=v,nodes:(v:any)=>nodes=v,writes:()=>writes};
}
it('syncs settings and URL metadata across different IDs without syncing usage counts',async()=>{
 const cloud={};const a=device(cloud,'local-a',{'usage:local-a':{count:9,lastOpened:7}});await a.store.ready();
 await a.store.setLayout({columns:8,searchEngine:'google',openInNewTab:true});await a.store.setName('local-a','我的文档');await a.store.setPinned('local-a',true);await a.store.flush();
 const b=device(cloud,'local-b');await b.store.ready();
 expect(b.local['layout:columns']).toBe(8);expect(b.local['layout:searchEngine']).toBe('google');expect(b.local['name:local-b']).toBe('我的文档');expect((await b.store.pins()).get('local-b')).toBe(true);
 expect(b.local['usage:local-b']).toBeUndefined();expect(JSON.stringify(cloud)).not.toContain('https://');expect(JSON.stringify(cloud)).not.toContain('lastOpened');
});
it('shares exact URLs but preserves query and fragment differences',async()=>{
 const d=device({});d.nodes([{id:'a',url:'https://x.test/a?q=1#one'},{id:'b',url:'https://x.test/a?q=1#one'},{id:'c',url:'https://x.test/a?q=2#one'},{id:'e',url:'https://x.test/a?q=1#two'}]);await d.store.ready();await d.store.setName('a','共享');await d.store.setPinned('a',true);
 expect(d.local['name:b']).toBe('共享');const pins=await d.store.pins();expect(pins.get('b')).toBe(true);expect(pins.get('c')).toBe(false);expect(pins.get('e')).toBe(false);
});
it('cloud values and tombstones beat legacy data, while an empty new device uploads no defaults',async()=>{
 const cloud={};const a=device(cloud);await a.store.ready();await a.store.setName('a','');await a.store.setPinned('a',false);await a.store.setLayout({columns:7});await a.store.flush();
 const b=device(cloud,'b',{'name:b':'旧名称','usage:b':{pinned:true},'layout:columns':12});await b.store.ready();expect(b.local['name:b']).toBeUndefined();expect((await b.store.pins()).get('b')).toBe(false);expect(b.local['layout:columns']).toBe(7);
 const blank=device({});await blank.store.ready();await blank.store.flush();expect(blank.writes()).toBe(0);
});
it('migrates old data once and keeps unmatched URL records for another computer',async()=>{
 const cloud={};const a=device(cloud,'a',{'name:a':'旧别名','usage:a':{pinned:true,count:8},'layout:rowGap':9});await a.store.ready();await a.store.flush();
 const b=device(cloud,'b');b.nodes([]);await b.store.ready();await b.store.flush();b.nodes([{id:'new',url:'https://example.test/docs?q=1#part'}]);await b.store.ready();await b.store.mirror();expect(b.local['name:new']).toBe('旧别名');expect((await b.store.pins()).get('new')).toBe(true);
});
it('persists offline edits across worker restart and retries without losing other devices changes',async()=>{
 const cloud={};const a=device(cloud);await a.store.ready();a.offline();await a.store.setLayout({rowGap:12});await a.store.setName('a','离线名称');await a.store.flush();expect(a.local['sync:status'].phase).toBe('error');
 const b=device(cloud,'b');await b.store.ready();await b.store.setLayout({columnGap:20});await b.store.flush();
 a.offline(false);const restarted=createSyncStore(a.api);await restarted.ready();await restarted.flush();const c=device(cloud,'c');await c.store.ready();expect(c.local['layout:rowGap']).toBe(12);expect(c.local['layout:columnGap']).toBe(20);expect(c.local['name:c']).toBe('离线名称');
});
it('does not migrate stale legacy values when the initial cloud read fails',async()=>{
 const cloud={};const a=device(cloud);await a.store.ready();await a.store.setLayout({columns:9});await a.store.flush();
 const b=device(cloud,'b',{'layout:columns':3});b.offline();await b.store.ready();expect(b.local['layout:columns']).toBe(3);b.offline(false);await b.store.flush();expect(b.local['layout:columns']).toBe(9);
});
it('merges concurrent fields in the same URL record and heals overwritten buckets',async()=>{
 const cloud={};const a=device(cloud);const b=device(cloud,'b');await Promise.all([a.store.ready(),b.store.ready()]);await a.store.setName('a','甲');await b.store.setPinned('b',true);await a.store.flush();const earlier=structuredClone(cloud);await b.store.flush();
 const changes=Object.fromEntries(Object.entries(cloud).map(([key,value])=>[key,{newValue:value}]));await a.store.receive(changes);await a.store.flush();Object.assign(cloud,earlier);await a.store.receive(Object.fromEntries(Object.entries(cloud).map(([key,value])=>[key,{newValue:value}])));await a.store.flush();
 const c=device(cloud,'c');await c.store.ready();expect(c.local['name:c']).toBe('甲');expect((await c.store.pins()).get('c')).toBe(true);
});
it('keeps quota failures pending and does not claim another computer received data',async()=>{
 const d=device({});await d.store.ready();await d.store.setName('a','a'.repeat(9000));await d.store.flush();expect(d.local['sync:status'].phase).toBe('error');expect(d.local['name:a']).toHaveLength(9000);expect(d.writes()).toBe(0);
});
it('exports/imports URL-based preferences with fresh versions and validates files',async()=>{
 const a=device({});await a.store.ready();await a.store.setName('a','备份');await a.store.setPinned('a',true);await a.store.setLayout({itemSize:22});const backup=await a.store.exportData();const b=device({},'b');await b.store.ready();await b.store.importData(backup);expect(b.local['name:b']).toBe('备份');expect(b.local['layout:itemSize']).toBe(22);expect((await b.store.pins()).get('b')).toBe(true);await expect(b.store.importData({format:'bad'})).rejects.toThrow();
});
it('does not echo identical records whose JSON property order differs',async()=>{
 const cloud:Record<string,any>={};const a=device(cloud);await a.store.ready();await a.store.setName('a','名称');await a.store.setPinned('a',true);await a.store.flush();
 const reordered=Object.fromEntries(Object.entries(cloud).map(([bucket,records])=>[bucket,{newValue:Object.fromEntries(Object.entries(records).map(([id,cells])=>[id,Object.fromEntries(Object.entries(cells as object).reverse())]))}]));
 await a.store.receive(reordered);expect(a.local['sync:status'].phase).toBe('accepted');
});
it('clears aliases when a bookmark URL changes, including while sync is unavailable',async()=>{
 const d=device({});d.offline();await d.store.setName('a','旧网址别名');d.nodes([{id:'a',url:'https://different.test/'}]);await d.store.mirror();expect(d.local['name:a']).toBeUndefined();
});
it('mirrors URL aliases onto newly created duplicate IDs when loading usage',async()=>{
 const d=device({});await d.store.ready();await d.store.setName('a','共享别名');d.nodes([{id:'a',url:'https://example.test/docs?q=1#part'},{id:'new',url:'https://example.test/docs?q=1#part'}]);
 const {createUsageStore}=await import('../public/usage-store.js');await createUsageStore(d.api,d.store).load();expect(d.local['name:new']).toBe('共享别名');
});
it('late-arriving cloud user settings beat automatic legacy migration',async()=>{
 const cloud={};const a=device(cloud);await a.store.ready();await a.store.setLayout({columns:9});await a.store.flush();
 const b=device(cloud,'b',{'layout:columns':3});const get=b.api.storage.sync.get;b.api.storage.sync.get=async()=>({});await b.store.ready();b.api.storage.sync.get=get;await b.store.flush();expect(b.local['layout:columns']).toBe(9);
});
it('surfaces unexpected flush errors and keeps local edits for a later retry',async()=>{
 const d=device({});await d.store.ready();await d.store.setLayout({columns:10});const tree=d.api.bookmarks.getTree;d.api.bookmarks.getTree=async()=>{throw Error('temporary tree failure');};await d.store.flush();expect(d.local['sync:status'].phase).toBe('error');d.api.bookmarks.getTree=tree;await d.store.flush();expect(d.local['sync:status'].phase).toBe('accepted');
});
it('an unpublished legacy field yields to previously migrated cloud data on a later read',async()=>{
 const database=(device:string)=>({version:1,device,clock:0,buckets:{},pending:[],migrated:false});
 const cloud={};const a=device(cloud,'a',{'sync:database:v1':database('000000000001'),'layout:columns':9});await a.store.ready();await a.store.flush();
 const b=device(cloud,'b',{'sync:database:v1':database('ffffffffffff'),'layout:columns':3});const get=b.api.storage.sync.get;b.api.storage.sync.get=async()=>({});await b.store.ready();b.api.storage.sync.get=get;await b.store.flush();expect(b.local['layout:columns']).toBe(9);
});
it('retains clear-name/unpin tombstones when an older device republishes stale data',async()=>{
 const cloud:Record<string,any>={};const a=device(cloud);await a.store.ready();await a.store.setName('a','旧名称');await a.store.setPinned('a',true);await a.store.flush();const old=structuredClone(cloud);
 await a.store.setName('a','');await a.store.setPinned('a',false);await a.store.flush();Object.assign(cloud,old);await a.store.receive(Object.fromEntries(Object.entries(old).map(([key,value])=>[key,{newValue:value}])));await a.store.flush();const b=device(cloud,'b');await b.store.ready();expect(b.local['name:b']).toBeUndefined();expect((await b.store.pins()).get('b')).toBe(false);
});
it('bounds sharded item count and keeps total-quota overflow local',async()=>{
 const cloud:Record<string,any>={};const d=device(cloud);await d.store.ready();const buckets:Record<string,any>={};
 for(let i=0;i<256;i++)buckets['bg2:'+i.toString(16).padStart(2,'0')]={['A'.repeat(43)]:{p:[true,'1-000000000001']}};
 await d.store.importData({format:'bookmark-grid-settings',version:1,buckets});await d.store.setLayout({columns:8});await d.store.flush();expect(Object.keys(cloud)).toHaveLength(257);
 for(const bucket of Object.values(buckets))for(let j=0;j<8;j++)bucket[String(j).padStart(43,'B')]={n:['名字'.repeat(25),'1-000000000001']};
 await d.store.importData({format:'bookmark-grid-settings',version:1,buckets});await d.store.flush();expect(d.local['sync:status'].phase).toBe('error');expect(d.local['sync:database:v1'].pending.length).toBeGreaterThan(0);
});
it('rolls back a cache write if the local layout mirror fails, rather than syncing a failed edit',async()=>{
 const cloud:Record<string,any>={};const d=device(cloud,'a',{'layout:columns':6});await d.store.ready();await d.store.flush();const set=d.api.storage.local.set;let fail=true;d.api.storage.local.set=async(patch:any)=>{if(fail&&patch['layout:columns']===10){fail=false;throw Error('mirror failure');}return set(patch);};await expect(d.store.setLayout({columns:10})).rejects.toThrow('mirror failure');await d.store.flush();const b=device(cloud,'b');await b.store.ready();expect(b.local['layout:columns']).toBe(6);
});
