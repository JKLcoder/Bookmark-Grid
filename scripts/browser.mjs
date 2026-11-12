import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {join,resolve,extname} from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
const server=createServer(async(req,res)=>{
 try{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const path=resolve('dist','.'+(pathname==='/'?'/index.html':pathname));
  if(!path.startsWith(resolve('dist')+'/'))throw new Error('Invalid path');
  const content=await readFile(path);
  res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html'})[extname(path)]||'application/octet-stream');res.end(content);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const profile=await mkdtemp(join(tmpdir(),'bookmark-grid-browser-'));
let context;
try{
 context=await chromium.launchPersistentContext(profile,{executablePath:process.env.CHROMIUM_PATH||'/usr/lib/chromium/chromium',headless:true,viewport:{width:1440,height:1000},env:{...process.env,XDG_CACHE_HOME:join(profile,'cache'),XDG_CONFIG_HOME:join(profile,'config')}});
 await context.addInitScript(()=>{
  const listeners=()=>{const set=new Set();return {addListener:fn=>set.add(fn),removeListener:fn=>set.delete(fn),fire:()=>set.forEach(fn=>fn())};};
  const data=JSON.parse(localStorage.getItem('test-names')||'{}');
  const titles=['React 文档','阿里云','百度','中文社区','TypeScript Handbook','GitHub','MDN Web Docs','Vite','设计灵感与非常非常长的书签标题用来验证文字溢出时不会破坏网格布局','知乎','Figma','Linear','Notion','重复网址'];
  const urls=['https://react.dev/','https://aliyun.com','https://baidu.com','https://example.com','https://typescriptlang.org/docs','https://github.com','https://developer.mozilla.org','https://vite.dev','https://design.example.com','https://zhihu.com','https://figma.com','https://linear.app','https://notion.so','https://react.dev/'];
  const bookmarks={getTree:async()=>[{id:'0',title:'',children:[{id:'folder',title:'前端开发',children:titles.map((title,i)=>({id:String(i),title,url:urls[i]}))}]}],onCreated:listeners(),onChanged:listeners(),onMoved:listeners(),onRemoved:listeners()};
  const onChanged=listeners();
  Object.defineProperty(globalThis,'chrome',{value:{bookmarks,storage:{local:{get:async()=>({...data}),set:async values=>{Object.assign(data,values);localStorage.setItem('test-names',JSON.stringify(data));onChanged.fire();},remove:async keys=>{for(const key of [keys].flat())delete data[key];localStorage.setItem('test-names',JSON.stringify(data));onChanged.fire();}},onChanged}},configurable:true});
 });
 const page=await context.newPage();const errors=[];const external=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:'))external.push(r.url());});
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.getByRole('link',{name:'React 文档 react.dev',exact:true}).waitFor();assert.equal(await page.getByRole('link').count(),14);
 await page.getByRole('searchbox').fill('react.dev');assert.equal(await page.getByRole('link').count(),2);
 await page.getByRole('button',{name:'清空搜索'}).click();
 await page.getByRole('button',{name:'编辑 React 文档',exact:true}).click();await page.getByRole('textbox',{name:'显示名称'}).fill('我的前端文档');await page.getByRole('button',{name:'保存名称',exact:true}).click();await page.getByRole('link',{name:'我的前端文档 react.dev',exact:true}).waitFor();
 await page.reload();await page.getByRole('link',{name:'我的前端文档 react.dev',exact:true}).waitFor();
 await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
 await page.screenshot({path:'/tmp/bookmark-grid-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);await page.screenshot({path:'/tmp/bookmark-grid-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 console.log('PASS: production page with mocked Chrome API: 14 bookmarks, duplicate-URL search, alias editing/reload, native modal Escape, desktop/mobile layouts, no external requests or runtime errors.');
}finally{await context?.close();await new Promise(r=>server.close(r));await rm(profile,{recursive:true,force:true});}
