import {createService} from './service.js';
const service=createService(chrome);
let timer;
async function planRetry(force=false) {
 // Arm first: even a transient local read failure must not consume the last retry.
 chrome.alarms?.create('bookmark-grid-sync',{delayInMinutes:1});
 if(force)return;
 try {
  const data=await chrome.storage.local.get('sync:status');
  if(!['pending','error'].includes(data['sync:status']?.phase))chrome.alarms?.clear('bookmark-grid-sync');
 }catch(error){console.error('Bookmark Grid: sync retry remains scheduled.',error);}
}
async function flushWithRetry() {
 let failed=false;
 try {await service.sync.flush();}
 catch(error){failed=true;console.error('Bookmark Grid: sync will retry.',error);}
 finally {await planRetry(failed);}
}
async function schedule() {
 await planRetry();
 const data=await chrome.storage.local.get('sync:status');
 if(timer||!['pending','error'].includes(data['sync:status']?.phase))return;
 timer=setTimeout(()=>{timer=undefined;void flushWithRetry().catch(console.error);},5000);
}
chrome.bookmarks.onRemoved.addListener((id,info)=>{
 const ids=[];function collect(node){ids.push(node.id);for(const child of node.children??[])collect(child);}
 collect(info.node??{id});
 void service.usage.remove(ids).catch(error=>console.error('Bookmark Grid: local cleanup failed.',error));
 // URL metadata is retained: another computer may still have this bookmark.
});
for(const event of [chrome.bookmarks.onCreated,chrome.bookmarks.onChanged])event?.addListener(()=>{void service.sync.mirror().then(schedule).catch(console.error);});
chrome.storage.onChanged?.addListener((changes,area)=>{
 if(area==='sync')void service.sync.receive(changes).then(schedule).catch(error=>{console.error(error);void planRetry(true);});
});
chrome.alarms?.onAlarm.addListener(alarm=>{if(alarm.name==='bookmark-grid-sync')void flushWithRetry().catch(console.error);});
chrome.runtime.onStartup?.addListener(()=>{void flushWithRetry().catch(console.error);});
chrome.runtime.onInstalled?.addListener(()=>{void flushWithRetry().catch(console.error);});
chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
 if(sender.id!==chrome.runtime.id||!message||typeof message!=='object')return false;
 const types=['usage:load','usage:record','usage:pin','sync:layout','sync:name','sync:flush','sync:export','sync:import'];
 if(!types.includes(message.type))return false;
 if(message.type==='usage:pin'&&(typeof message.id!=='string'||typeof message.pinned!=='boolean'))return false;
 service.request(message).then(data=>{sendResponse({ok:true,data});if(message.type!=='usage:record')void schedule().catch(console.error);},error=>sendResponse({ok:false,error:error instanceof Error?error.message:'保存失败。'}));
 return true;
});
