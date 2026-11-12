export function searchWithDefaultEngine(input:string):Promise<void> {
 const text=input.trim();
 if(!text)return Promise.resolve();
 return new Promise((resolve,reject)=>{
  if(!globalThis.chrome?.search?.query){reject(Error('浏览器搜索不可用，请检查扩展的 search 权限后重试。'));return;}
  chrome.search.query({text,disposition:'CURRENT_TAB'},()=>{
   const error=chrome.runtime.lastError;
   if(error)reject(Error(error.message||'搜索失败，请重试。'));else resolve();
  });
 });
}
