import {createSyncStore} from './sync-store.js';
import {createUsageStore} from './usage-store.js';
export function createService(api) {
 const sync=createSyncStore(api);
 const usage=createUsageStore(api,sync);
 function request(message) {
  if(!message||typeof message!=='object')return Promise.reject(Error('请求无效。'));
  if(message.type==='usage:load')return usage.load();
  if(message.type==='usage:record'&&typeof message.id==='string')return usage.record(message.id);
  if(message.type==='usage:pin'&&typeof message.id==='string'&&typeof message.pinned==='boolean')return usage.setPinned(message.id,message.pinned);
  if(message.type==='sync:layout'&&message.patch&&typeof message.patch==='object'&&!Array.isArray(message.patch))return sync.setLayout(message.patch);
  if(message.type==='sync:name'&&typeof message.id==='string'&&typeof message.name==='string')return sync.setName(message.id,message.name);
  if(message.type==='sync:flush')return sync.flush();
  if(message.type==='sync:export')return sync.exportData();
  if(message.type==='sync:import')return sync.importData(message.data);
  return Promise.reject(Error('请求无效。'));
 }
 return {sync,usage,request};
}
