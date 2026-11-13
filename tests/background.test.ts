import {beforeEach,it,expect,vi} from 'vitest';
let removed:any;let message:any;let api:any;
beforeEach(async()=>{
 vi.resetModules();
 api={bookmarks:{onRemoved:{addListener:(fn:any)=>removed=fn},get:async(id:string)=>[{id,url:'https://a.test'}],getTree:async()=>[]},storage:{local:{get:async()=>({}),set:async()=>{},remove:vi.fn(async()=>{})}},runtime:{id:'ours',onMessage:{addListener:(fn:any)=>message=fn}}};
 vi.stubGlobal('chrome',api);await import('../public/background.js');
});
it('cleans a deleted subtree while pages are closed',async()=>{removed('folder',{node:{id:'folder',children:[{id:'a'},{id:'nested',children:[{id:'b'}]}]}});await vi.waitFor(()=>expect(api.storage.local.remove).toHaveBeenCalledWith(['name:folder','usage:folder','name:a','usage:a','name:nested','usage:nested','name:b','usage:b']));});
it('keeps the async response alive and returns actual result',async()=>{let response:any;expect(message({type:'usage:record',id:'a'},{id:'ours'},(r:any)=>response=r)).toBe(true);await vi.waitFor(()=>expect(response?.data.count).toBe(1));expect(response.ok).toBe(true);});
it('returns storage failures rather than fake success',async()=>{api.storage.local.set=async()=>{throw Error('quota')};let response:any;message({type:'usage:pin',id:'a',pinned:true},{id:'ours'},(r:any)=>response=r);await vi.waitFor(()=>expect(response).toEqual({ok:false,error:'quota'}));});
it('ignores invalid messages and other extensions',()=>{expect(message({type:'usage:load'},{id:'other'},()=>{})).toBe(false);expect(message({type:'usage:pin',id:'a',pinned:'bad'},{id:'ours'},()=>{})).toBe(false);});
it('rearms an automatic alarm after an unexpected flush failure',async()=>{
 vi.useFakeTimers();
 try {
  vi.resetModules();const local:Record<string,any>={};let alarm:any;let fail=false;
  api.storage.local.get=async()=>({...local});api.storage.local.set=async(patch:object)=>Object.assign(local,patch);
  api.storage.sync={get:async()=>({}),set:async()=>{}};
  api.bookmarks.getTree=async()=>{if(fail)throw Error('temporary tree failure');return [];};
  api.alarms={create:vi.fn(),clear:vi.fn(),onAlarm:{addListener:(fn:any)=>alarm=fn}};
  await import('../public/background.js');let response:any;
  message({type:'sync:layout',patch:{columns:8}},{id:'ours'},(r:any)=>response=r);
  await vi.waitFor(()=>expect(response?.ok).toBe(true));
  api.alarms.create.mockClear();fail=true;alarm({name:'bookmark-grid-sync'});
  await vi.waitFor(()=>expect(api.alarms.create).toHaveBeenCalledWith('bookmark-grid-sync',{delayInMinutes:1}));
 } finally {vi.clearAllTimers();vi.useRealTimers();}
});
it('restores the retry alarm on startup even if initialization fails',async()=>{
 vi.useFakeTimers();
 try {
  vi.resetModules();const local:Record<string,any>={};let startup:any;let fail=false;
  api.storage.local.get=async()=>({...local});api.storage.local.set=async(patch:object)=>Object.assign(local,patch);
  api.storage.sync={get:async()=>({}),set:async()=>{}};api.bookmarks.getTree=async()=>{if(fail)throw Error('startup tree failure');return [];};
  api.alarms={create:vi.fn(),clear:vi.fn(),onAlarm:{addListener:()=>{}}};api.runtime.onStartup={addListener:(fn:any)=>startup=fn};
  await import('../public/background.js');let response:any;message({type:'sync:layout',patch:{columns:8}},{id:'ours'},(r:any)=>response=r);await vi.waitFor(()=>expect(response?.ok).toBe(true));
  vi.clearAllTimers();vi.resetModules();api.alarms.create.mockClear();fail=true;await import('../public/background.js');startup();
  await vi.waitFor(()=>expect(api.alarms.create).toHaveBeenCalledWith('bookmark-grid-sync',{delayInMinutes:1}));
 }finally{vi.clearAllTimers();vi.useRealTimers();}
});
