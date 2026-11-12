import {createUsageStore} from './usage-store.js';
const usage = createUsageStore(chrome);
// Register synchronously so Chrome wakes this worker even with no page open.
chrome.bookmarks.onRemoved.addListener((id, info) => {
 const ids = [];
 function collect(node) { ids.push(node.id); for (const child of node.children ?? []) collect(child); }
 collect(info.node ?? { id });
 usage.remove(ids).catch(error => console.error('Bookmark Grid: local cleanup failed; next page load will retry.', error));
});
chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
 if (sender.id !== chrome.runtime.id || !message || typeof message !== 'object') return false;
 let operation;
 if (message.type === 'usage:load') operation = usage.load();
 else if (message.type === 'usage:record' && typeof message.id === 'string') operation = usage.record(message.id);
 else if (message.type === 'usage:pin' && typeof message.id === 'string' && typeof message.pinned === 'boolean') operation = usage.setPinned(message.id,message.pinned);
 else return false;
 operation.then(data=>sendResponse({ok:true,data}),error=>sendResponse({ok:false,error:error instanceof Error?error.message:'本地记录失败。'}));
 return true; // Chrome 93-compatible async response lifetime.
});
