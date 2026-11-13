export interface SyncStatus {phase:'pending'|'accepted'|'error'|'unavailable';error:string}
export function syncRequest<T=void>(message:object):Promise<T> {
 return new Promise((resolve,reject)=>{
  if(!globalThis.chrome?.runtime?.sendMessage){reject(Error('请在 Chrome 扩展中操作。'));return;}
  chrome.runtime.sendMessage(message,(response)=>{
   const error=chrome.runtime.lastError;
   if(error)reject(Error(error.message||'后台暂不可用，请重试。'));
   else if(!response?.ok)reject(Error(response?.error||'保存失败，请重试。'));
   else resolve(response.data as T);
  });
 });
}
