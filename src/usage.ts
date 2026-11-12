export interface Usage {count:number;lastOpened:number;pinned:boolean}
export type UsageMap = Record<string,Usage>;
type Message = {type:'usage:load'}|{type:'usage:record';id:string}|{type:'usage:pin';id:string;pinned:boolean};
function request<T>(message:Message):Promise<T> {
 return new Promise((resolve,reject)=>{
  if(!globalThis.chrome?.runtime?.sendMessage){reject(Error('请在 Chrome 扩展中新建标签页。'));return;}
  chrome.runtime.sendMessage(message,(response)=>{
   const error=chrome.runtime.lastError;
   if(error){reject(Error(error.message||'后台暂不可用，请重试。'));return;}
   if(!response?.ok){reject(Error(response?.error||'后台记录失败，请重试。'));return;}
   resolve(response.data as T);
  });
 });
}
export const loadUsage = ()=>request<UsageMap>({type:'usage:load'});
export async function recordOpen(id:string):Promise<void>{await request<Usage>({type:'usage:record',id});}
export async function setPinned(id:string,pinned:boolean):Promise<void>{await request<Usage>({type:'usage:pin',id,pinned});}
