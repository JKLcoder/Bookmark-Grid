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
 context=await chromium.launchPersistentContext(profile,{executablePath:process.env.CHROMIUM_PATH||'/usr/lib/chromium/chromium',headless:true,viewport:{width:1487,height:1058},env:{...process.env,XDG_CACHE_HOME:join(profile,'cache'),XDG_CONFIG_HOME:join(profile,'config')}});
 await context.addInitScript(()=>{
  const listeners=()=>{const set=new Set();return {addListener:fn=>set.add(fn),removeListener:fn=>set.delete(fn),fire:()=>set.forEach(fn=>fn())};};
  const data=JSON.parse(localStorage.getItem('test-names')||'{}');
  const titles=['阿里云','百度','北京大学','哔哩哔哩','博客园','菜鸟教程','豆瓣','飞书','高德地图','即刻','京东','掘金','开发者社区','美团','少数派','淘宝','腾讯文档','网易云音乐','微信公众平台','React 文档','小红书','语雀','知乎','中国大学慕课','CodePen','Dribbble','Figma','GitHub','Linear','MDN Web Docs','Notion','npm','Stack Overflow','TypeScript','Vercel','Vite'];
  const urls=titles.map((_,i)=>i===19||i===29?'https://react.dev/':`https://example-${i}.test`);
  const bookmarks={getTree:async()=>[{id:'0',title:'',children:[{id:'folder',title:'前端开发',children:titles.map((title,i)=>({id:String(i),title,url:urls[i]}))}]}],onCreated:listeners(),onChanged:listeners(),onMoved:listeners(),onRemoved:listeners()};
  const onChanged=listeners();
  Object.defineProperty(globalThis,'chrome',{value:{bookmarks,storage:{local:{get:async()=>({...data}),set:async values=>{Object.assign(data,values);localStorage.setItem('test-names',JSON.stringify(data));onChanged.fire();},remove:async keys=>{for(const key of [keys].flat())delete data[key];localStorage.setItem('test-names',JSON.stringify(data));onChanged.fire();}},onChanged}},configurable:true});
 });
 const page=await context.newPage();const errors=[];const external=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:'))external.push(r.url());});
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.getByRole('link',{name:'React 文档',exact:true}).waitFor();assert.equal(await page.getByRole('link').count(),36);
 await page.getByRole('searchbox').fill('react.dev');assert.equal(await page.getByRole('link').count(),2);
 await page.getByRole('button',{name:'清空搜索'}).click();
 await page.getByRole('button',{name:'编辑 React 文档',exact:true}).click();await page.getByRole('textbox',{name:'显示名称'}).fill('我的前端文档');await page.getByRole('button',{name:'保存名称',exact:true}).click();await page.getByRole('link',{name:'我的前端文档',exact:true}).waitFor();
 await page.reload();await page.getByRole('link',{name:'我的前端文档',exact:true}).waitFor();
 await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
 await page.getByRole('button',{name:'设置',exact:true}).click();
 await page.getByRole('combobox',{name:'列数'}).selectOption('8');
 await page.getByRole('slider',{name:'行间距'}).focus();await page.keyboard.press('ArrowRight');
 await page.waitForFunction(()=>document.querySelector('.bookmark-grid').style.rowGap==='5px');
 await page.getByRole('slider',{name:'列间距'}).focus();await page.keyboard.press('ArrowRight');
 await page.waitForFunction(()=>document.querySelector('.bookmark-grid').style.columnGap==='13px');
 await page.getByRole('slider',{name:'文字与图标大小'}).focus();await page.keyboard.press('ArrowRight');
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('.bookmark-item a')).fontSize==='17px');
 await page.getByRole('button',{name:'关闭设置'}).click();
 await page.reload();await page.getByRole('link',{name:'我的前端文档',exact:true}).waitFor();
 await page.getByRole('button',{name:'设置',exact:true}).click();
 assert.equal(await page.getByRole('combobox',{name:'列数'}).inputValue(),'8');
 assert.equal(await page.getByRole('slider',{name:'行间距'}).inputValue(),'5');
 assert.equal(await page.getByRole('slider',{name:'列间距'}).inputValue(),'13');
 assert.equal(await page.getByRole('slider',{name:'文字与图标大小'}).inputValue(),'17');
 for(const [key,size] of [['Home',12],['End',28]]){
  await page.getByRole('slider',{name:'文字与图标大小'}).focus();await page.keyboard.press(key);
  await page.waitForFunction(expected=>{const link=document.querySelector('.bookmark-item a');const icon=link.querySelector('.bookmark-favicon');return getComputedStyle(link).fontSize===`${expected}px`&&icon.getBoundingClientRect().width===expected&&icon.getBoundingClientRect().height===expected;},size);
 }
 await page.getByRole('button',{name:'恢复默认'}).click();
 await page.waitForFunction(()=>document.querySelector('#columns').value==='6'&&document.querySelector('#rowGap').value==='4'&&document.querySelector('#columnGap').value==='12');
 await page.getByRole('button',{name:'关闭设置'}).click();
 await page.getByRole('link',{name:'我的前端文档',exact:true}).hover();
 await page.screenshot({path:'/tmp/bookmark-grid-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'设置',exact:true}).click();
 await page.getByRole('link',{name:'我的前端文档',exact:true}).hover();
 await page.screenshot({path:'/tmp/bookmark-grid-settings.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
 await page.screenshot({path:'/tmp/bookmark-grid-mobile-settings.png',fullPage:true});
 await page.getByRole('button',{name:'关闭设置'}).click();
 await page.screenshot({path:'/tmp/bookmark-grid-mobile.png',fullPage:true});
 assert.equal(await page.locator('.item-domain').count(),0);
 assert.equal(await page.locator('.bookmark-item a').first().evaluate(el=>getComputedStyle(el).height),'42px');
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 console.log('PASS: production page with mocked Chrome API: 36 bookmarks; layout columns/gaps/shared icon-text sizes persist; 12px and 28px dimensions match; reset and responsive cap, duplicate-URL search, alias editing/reload, native modal Escape, desktop/mobile layouts, no external requests or runtime errors.');
}finally{await context?.close();await new Promise(r=>server.close(r));await rm(profile,{recursive:true,force:true});}
