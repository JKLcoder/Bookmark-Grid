import type {SearchEngine} from './layout';
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

export const ENGINE_NAMES:Record<SearchEngine,string>={browser:'默认搜索引擎',baidu:'百度',google:'Google'};
export function buildSearchUrl(input:string,engine:'baidu'|'google'):string|null {
 const text=input.trim();
 if(!text)return null;
 const url=new URL(engine==='baidu'?'https://www.baidu.com/s':'https://www.google.com/search');
 url.searchParams.set(engine==='baidu'?'wd':'q',text);
 return url.href;
}
export async function searchWithEngine(input:string,engine:SearchEngine,navigate:(url:string)=>void=url=>window.location.assign(url)):Promise<void> {
 if(engine==='browser'){await searchWithDefaultEngine(input);return;}
 const url=buildSearchUrl(input,engine);
 if(url)navigate(url);
}
