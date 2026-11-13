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
 const fixture=()=>{
  const listeners=()=>{const set=new Set();return {addListener:fn=>set.add(fn),removeListener:fn=>set.delete(fn),fire:()=>set.forEach(fn=>fn())};};
  const data=JSON.parse(localStorage.getItem('test-names')||'{}');
  const titles=['阿里云','百度','北京大学','哔哩哔哩','博客园','菜鸟教程','豆瓣','飞书','高德地图','即刻','京东','掘金','开发者社区','美团','少数派','淘宝','腾讯文档','网易云音乐','微信公众平台','React 文档','小红书','语雀','知乎','中国大学慕课','CodePen','Dribbble','Figma','GitHub','Linear','MDN Web Docs','Notion','npm','Stack Overflow','TypeScript','Vercel','Vite'];
  const urls=titles.map((_,i)=>i===19||i===29?'https://react.dev/':`https://example-${i}.test`);
  const removed=new Set(JSON.parse(localStorage.getItem('test-removed')||'[]'));
  const bookmarks={getTree:async()=>[{id:'0',title:'',children:[{id:'folder',title:'前端开发',children:titles.map((title,i)=>({id:String(i),title,url:urls[i]})).filter(node=>!removed.has(node.id))}]}],onCreated:listeners(),onChanged:listeners(),onMoved:listeners(),onRemoved:listeners()};
  bookmarks.get=async id=>{const i=Number(id);if(!Number.isInteger(i)||!titles[i]||removed.has(id))throw Error('missing');return [{id,title:titles[i],url:urls[i]}];};
  const onChanged=listeners();
  globalThis.__failNextPreferenceSave=false;
  Object.defineProperty(globalThis,'chrome',{value:{bookmarks,storage:{local:{get:async()=>({...data}),set:async values=>{if(globalThis.__failNextPreferenceSave&&Object.keys(values).some(key=>key.startsWith('layout:'))){globalThis.__failNextPreferenceSave=false;await new Promise(resolve=>setTimeout(resolve,80));throw Error('Fixture save failure');}Object.assign(data,values);localStorage.setItem('test-names',JSON.stringify(data));onChanged.fire();},remove:async keys=>{for(const key of [keys].flat())delete data[key];localStorage.setItem('test-names',JSON.stringify(data));onChanged.fire();}},onChanged}},configurable:true});
  let storePromise;
  chrome.runtime={sendMessage:(message,callback)=>{
   storePromise??=import(location.origin+'/usage-store.js').then(module=>module.createUsageStore(chrome));
   storePromise.then(store=>message.type==='usage:load'?store.load():message.type==='usage:record'?store.record(message.id):store.setPinned(message.id,message.pinned)).then(data=>callback({ok:true,data}),error=>callback({ok:false,error:error.message}));
  }};
  bookmarks.remove=async id=>{
   if(globalThis.__failNextDelete){globalThis.__failNextDelete=false;throw Error('Fixture delete failure');}
   await bookmarks.get(id);removed.add(id);localStorage.setItem('test-removed',JSON.stringify([...removed]));
   bookmarks.onRemoved.fire();
   // Match the production worker's onRemoved cleanup using its actual serialized store.
   storePromise??=import(location.origin+'/usage-store.js').then(module=>module.createUsageStore(chrome));
   void storePromise.then(store=>store.remove([id]));
  };
  chrome.search={query:(options,callback)=>{globalThis.__engineQueries??=[];globalThis.__engineQueries.push(options);callback();}};
 };
 await context.addInitScript(fixture);
 const page=await context.newPage();const errors=[];const external=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:'))external.push(r.url());});
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.getByRole('link',{name:'React 文档',exact:true}).waitFor();assert.equal(await page.getByRole('link').count(),36);
 assert.equal(await page.getByRole('combobox',{name:'搜索模式'}).inputValue(),'engine');
 await page.getByRole('searchbox').fill('react.dev');assert.equal(await page.getByRole('link').count(),36);
 assert.equal(await page.evaluate(()=>globalThis.__engineQueries?.length||0),0);
 await page.getByRole('searchbox').press('Enter');
 await page.waitForFunction(()=>globalThis.__engineQueries?.length===1);
 assert.deepEqual(await page.evaluate(()=>globalThis.__engineQueries[0]),{text:'react.dev',disposition:'CURRENT_TAB'});
 await page.getByRole('combobox',{name:'搜索模式'}).selectOption('bookmarks');assert.equal(await page.getByRole('link').count(),2);
 await page.getByRole('button',{name:'清空搜索'}).click();
 await page.getByRole('link',{name:'React 文档',exact:true}).hover();
 await page.getByRole('button',{name:'编辑 React 文档',exact:true}).click();await page.getByRole('textbox',{name:'显示名称'}).fill('我的前端文档');await page.getByRole('button',{name:'保存名称',exact:true}).click();await page.getByRole('link',{name:'我的前端文档',exact:true}).waitFor();
 await page.reload();await page.getByRole('link',{name:'我的前端文档',exact:true}).waitFor();
 assert.equal(await page.getByRole('combobox',{name:'搜索模式'}).inputValue(),'engine');
 await page.getByRole('link',{name:'Vite',exact:true}).hover();
 await page.getByRole('button',{name:'置顶 Vite',exact:true}).click();
 await page.getByRole('button',{name:'取消置顶 Vite',exact:true,includeHidden:true}).waitFor({state:'attached'});
 assert.equal(await page.getByRole('link').first().innerText(),'Vite');
 const previous=await page.getByRole('link').allTextContents();
 // DOM-level native auxclick invokes the real React handler without opening an external tab in this fixture.
 for(let i=0;i<3;i++)await page.getByRole('link',{name:'GitHub',exact:true}).dispatchEvent('auxclick',{button:1});
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('test-names')||'{}')['usage:27']?.count===3);
 assert.deepEqual(await page.getByRole('link').allTextContents(),previous);
 await page.reload();await page.getByRole('button',{name:'取消置顶 Vite',exact:true,includeHidden:true}).waitFor({state:'attached'});
 await page.waitForFunction(()=>document.querySelectorAll('.bookmark-item a')[1]?.textContent==='GitHub');
 await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
 await page.getByRole('button',{name:'设置',exact:true}).click();
 await page.getByRole('combobox',{name:'期望列数'}).selectOption('8');
 await page.getByRole('slider',{name:'行间距'}).focus();await page.keyboard.press('ArrowRight');
 await page.waitForFunction(()=>document.querySelector('.bookmark-grid').style.rowGap==='5px');
 await page.getByRole('slider',{name:'列间距'}).focus();await page.keyboard.press('ArrowRight');
 await page.waitForFunction(()=>document.querySelector('.bookmark-grid').style.columnGap==='13px');
 await page.getByRole('slider',{name:'文字与图标大小'}).focus();await page.keyboard.press('ArrowRight');
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('.bookmark-item a')).fontSize==='17px');
 await page.getByRole('button',{name:'关闭设置'}).click();
 await page.reload();await page.getByRole('link',{name:'我的前端文档',exact:true}).waitFor();
 await page.getByRole('button',{name:'设置',exact:true}).click();
 assert.equal(await page.getByRole('combobox',{name:'期望列数'}).inputValue(),'8');
 assert.equal(await page.getByRole('slider',{name:'行间距'}).inputValue(),'5');
 assert.equal(await page.getByRole('slider',{name:'列间距'}).inputValue(),'13');
 assert.equal(await page.getByRole('slider',{name:'文字与图标大小'}).inputValue(),'17');
 // Use a decoded high-resolution image: fallback SVG-only checks missed intrinsic-image overflow.
 await page.locator('.bookmark-favicon').first().evaluate(async holder=>{
  const image=new Image();image.src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#9ac9ae"/></svg>');
  await image.decode();holder.replaceChildren(image);
 });
 for(const [key,size] of [['Home',12],['End',28]]){
  await page.getByRole('slider',{name:'文字与图标大小'}).focus();await page.keyboard.press(key);
  await page.waitForFunction(expected=>{const link=document.querySelector('.bookmark-item a');const icon=link.querySelector('.bookmark-favicon');return getComputedStyle(link).fontSize===`${expected}px`&&icon.getBoundingClientRect().width===expected&&icon.getBoundingClientRect().height===expected;},size);
  const imageGeometry=await page.locator('.bookmark-item').first().evaluate(item=>{
   const image=item.querySelector('.bookmark-favicon img').getBoundingClientRect();
   const text=item.querySelector('.item-name').getBoundingClientRect();
   return {width:image.width,height:image.height,gap:text.left-image.right};
  });
  assert.equal(imageGeometry.width,size,'real favicon width must match text size');
  assert.equal(imageGeometry.height,size,'real favicon height must match text size');
  assert.ok(imageGeometry.gap>=10,'favicon must leave at least 10px before text');
 }
 await page.getByRole('button',{name:'恢复布局默认'}).click();
 await page.waitForFunction(()=>document.querySelector('#columns').value==='6'&&document.querySelector('#rowGap').value==='4'&&document.querySelector('#columnGap').value==='12');
 await page.getByRole('button',{name:'关闭设置'}).click();
 await page.getByRole('link',{name:'我的前端文档',exact:true}).hover();
 await page.screenshot({path:'/tmp/bookmark-grid-desktop.png',fullPage:true});
 await page.getByRole('combobox',{name:'搜索模式'}).selectOption('bookmarks');
 await page.getByRole('searchbox').fill('react.dev');
 await page.screenshot({path:'/tmp/bookmark-grid-bookmark-search.png',fullPage:true});
 await page.getByRole('button',{name:'清空搜索'}).click();
 await page.getByRole('combobox',{name:'搜索模式'}).selectOption('engine');
 await page.getByRole('button',{name:'设置',exact:true}).click();
 await page.getByRole('link',{name:'我的前端文档',exact:true}).hover();
 await page.screenshot({path:'/tmp/bookmark-grid-settings.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
 await page.screenshot({path:'/tmp/bookmark-grid-mobile-settings.png',fullPage:true});
 await page.getByRole('button',{name:'关闭设置'}).click();
 await page.screenshot({path:'/tmp/bookmark-grid-mobile.png',fullPage:true});
 assert.equal(await page.locator('.item-domain').count(),0);
 assert.equal(await page.locator('.bookmark-item a').first().evaluate(el=>getComputedStyle(el).height),'44px');
 assert.deepEqual(external,[],'Typing and local interactions must not make external requests');
 await page.setViewportSize({width:1487,height:1058});
 await page.getByRole('button',{name:'设置',exact:true}).click();
 await page.getByRole('combobox',{name:'书签打开方式'}).focus();await page.keyboard.press('Tab');
 assert.equal(await page.getByRole('dialog',{name:'页面设置'}).count(),0);
 assert.equal(await page.getByRole('button',{name:'设置',exact:true}).evaluate(e=>document.activeElement===e),true);
 await page.keyboard.press('/');assert.equal(await page.getByRole('searchbox').evaluate(e=>document.activeElement===e),true);
 await page.getByRole('button',{name:'设置',exact:true}).click();
 await page.evaluate(()=>{globalThis.__failNextPreferenceSave=true;});
 await page.getByRole('combobox',{name:'期望列数'}).selectOption('9');
 await page.getByRole('button',{name:'关闭设置'}).click();
 await page.getByRole('alert').filter({hasText:'Fixture save failure'}).waitFor();
 await page.evaluate(()=>chrome.storage.local.set({'audit:refresh':1}));
 await page.getByRole('button',{name:'设置',exact:true}).click();
 assert.equal(await page.getByRole('combobox',{name:'期望列数'}).inputValue(),'9');
 await page.getByRole('button',{name:'关闭设置'}).click();
 await page.screenshot({path:'/tmp/bookmark-grid-save-error.png',fullPage:true});
 await page.getByRole('button',{name:'重试保存'}).click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('test-names')||'{}')['layout:columns']===9);
 await page.getByRole('alert').waitFor({state:'detached'});
 await page.getByRole('button',{name:'设置',exact:true}).click();
 await page.getByRole('button',{name:'恢复布局默认'}).click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('test-names')||'{}')['layout:columns']===6);
 await page.evaluate(()=>{globalThis.__failNextPreferenceSave=true;});
 await page.getByRole('combobox',{name:'期望列数'}).selectOption('10');
 await page.getByRole('button',{name:'关闭设置'}).click();
 await page.getByRole('alert').filter({hasText:'Fixture save failure'}).waitFor();
 await page.getByRole('button',{name:'撤销未保存更改'}).click();
 await page.getByRole('alert').waitFor({state:'detached'});
 await page.getByRole('button',{name:'设置',exact:true}).click();
 assert.equal(await page.getByRole('combobox',{name:'期望列数'}).inputValue(),'6');
 await page.getByRole('combobox',{name:'期望列数'}).selectOption('12');
 await page.getByRole('slider',{name:'文字与图标大小'}).focus();await page.keyboard.press('End');
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('.bookmark-grid')).gridTemplateColumns.split(' ').length===4);
 await page.getByText('已选择 12 列，当前显示 4 列。已按字号和窗口宽度保护名称可读性。').waitFor();
 await page.getByRole('button',{name:'关闭设置'}).click();
 await page.mouse.move(0,0);
 const large=await page.evaluate(()=>({clipped:[...document.querySelectorAll('.item-name')].filter(e=>e.scrollWidth>e.clientWidth).map(e=>e.textContent),top:document.querySelector('.bookmark-grid').getBoundingClientRect().top}));
 assert.deepEqual(large.clipped,[]);assert.ok(large.top<160);
 await page.screenshot({path:'/tmp/bookmark-grid-large-readable.png',fullPage:true});
 await page.getByRole('link',{name:'我的前端文档',exact:true}).hover();
 assert.equal(await page.getByRole('button',{name:'编辑 我的前端文档'}).evaluate(e=>e.getBoundingClientRect().width),32);
 await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByRole('button',{name:'恢复布局默认'}).click();await page.getByRole('button',{name:'关闭设置'}).click();
 const touch=await context.browser().newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});await touch.addInitScript(fixture);
 const mobile=await touch.newPage();await mobile.goto(page.url());await mobile.getByRole('link').first().waitFor();
 assert.equal(await mobile.evaluate(()=>matchMedia('(hover:none)').matches),true);
 await mobile.getByRole('button',{name:'设置',exact:true}).click();await mobile.getByRole('slider',{name:'文字与图标大小'}).focus();await mobile.keyboard.press('End');await mobile.getByRole('button',{name:'关闭设置'}).click();
 await mobile.waitForFunction(()=>getComputedStyle(document.querySelector('.bookmark-grid')).gridTemplateColumns.split(' ').length===1);
 assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.equal(await mobile.locator('.item-name').evaluateAll(items=>items.filter(e=>e.scrollWidth>e.clientWidth).length),0);
 await mobile.getByRole('button',{name:'编辑 阿里云',exact:true}).waitFor({state:'visible'});
 await mobile.screenshot({path:'/tmp/bookmark-grid-touch-large.png',fullPage:true});await touch.close();
 // Independent domain-grouping fixture keeps existing browser scenarios unchanged.
 const groupedContext=await context.browser().newContext({viewport:{width:1487,height:1058}});
 await groupedContext.addInitScript(fixture);
 await groupedContext.addInitScript(()=>{
  const items=[
   {id:'g1',title:'匹配 GitHub 一',url:'http://www.github.com/a'},
   {id:'o',title:'匹配 Other',url:'https://other.test/a'},
   {id:'g2',title:'GitHub 二',url:'https://GITHUB.COM:8443/b'},
   {id:'p',title:'置顶仓库',url:'https://github.com/p'},
   {id:'w',title:'Wiki',url:'https://wiki.test/a'},
  ];
  chrome.bookmarks.getTree=async()=>[{id:'0',title:'',children:items}];
  chrome.bookmarks.get=async id=>items.filter(item=>item.id===id);
  void chrome.storage.local.set({
   'usage:g1':{count:1,lastOpened:1,pinned:false},'usage:g2':{count:7,lastOpened:1,pinned:false},
   'usage:o':{count:9,lastOpened:1,pinned:false},'usage:p':{count:20,lastOpened:1,pinned:true},
   'usage:w':{count:2,lastOpened:1,pinned:false},
  });
 });
 const groupedPage=await groupedContext.newPage();await groupedPage.goto(page.url());
 await groupedPage.getByText('5 个书签',{exact:true}).waitFor();
 const groupedOrder=['置顶仓库','GitHub 二','匹配 GitHub 一','匹配 Other','Wiki'];
 await groupedPage.waitForFunction(()=>document.querySelectorAll('.bookmark-link')[1]?.textContent==='GitHub 二');
 assert.deepEqual(await groupedPage.getByRole('link').allTextContents(),groupedOrder);
 await groupedPage.getByRole('combobox',{name:'搜索模式'}).selectOption('bookmarks');
 await groupedPage.getByRole('searchbox').fill('匹配');
 assert.deepEqual(await groupedPage.getByRole('link').allTextContents(),['匹配 GitHub 一','匹配 Other']);
 await groupedPage.getByRole('button',{name:'清空搜索'}).click();
 assert.deepEqual(await groupedPage.getByRole('link').allTextContents(),groupedOrder);
 await groupedPage.screenshot({path:'/tmp/bookmark-grid-site-grouping.png',fullPage:true});
 await groupedContext.close();
 const appUrl=page.url();
 const googleUrl='https://www.google.com/search?q=%E4%B8%AD%E6%96%87+%26+C%2B%2B';
 const baiduUrl='https://www.baidu.com/s?wd=%E4%B8%AD%E6%96%87+%26+C%2B%2B';
 for(const url of [googleUrl,baiduUrl,'https://example-0.test/'])await context.route(url,route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Navigation fixture</title><p>Intercepted local test response</p>'}));
 await page.getByRole('button',{name:'设置',exact:true}).click();
 await page.getByRole('combobox',{name:'网页搜索引擎'}).selectOption('google');
 await page.getByRole('combobox',{name:'书签打开方式'}).selectOption('new');
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('test-names')||'{}')['layout:openInNewTab']===true);
 await page.reload();await page.getByRole('link',{name:'阿里云',exact:true}).waitFor();
 await page.getByRole('button',{name:'设置',exact:true}).click();
 assert.equal(await page.getByRole('combobox',{name:'网页搜索引擎'}).inputValue(),'google');
 assert.equal(await page.getByRole('combobox',{name:'书签打开方式'}).inputValue(),'new');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:'/tmp/bookmark-grid-preferences-mobile.png',fullPage:true});
 await page.setViewportSize({width:1487,height:1058});
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('.bookmark-grid')).gridTemplateColumns.split(' ').length===6);
 await page.screenshot({path:'/tmp/bookmark-grid-preferences-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'关闭设置'}).click();
 const newPagePromise=context.waitForEvent('page');
 await page.getByRole('link',{name:'阿里云',exact:true}).click();
 const opened=await newPagePromise;await opened.waitForURL('https://example-0.test/');
 assert.equal(page.url(),appUrl);assert.equal(await opened.evaluate(()=>window.opener===null),true);await opened.close();
 await page.getByRole('searchbox').fill('中文 & C++');await page.getByRole('searchbox').press('Enter');
 await page.waitForURL(googleUrl);assert.equal(page.url(),googleUrl);
 await page.goto(appUrl);await page.getByRole('link',{name:'阿里云',exact:true}).waitFor();
 await page.getByRole('button',{name:'设置',exact:true}).click();
 await page.getByRole('combobox',{name:'网页搜索引擎'}).selectOption('baidu');
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('test-names')||'{}')['layout:searchEngine']==='baidu');
 await page.getByRole('button',{name:'关闭设置'}).click();
 await page.getByRole('searchbox').fill('中文 & C++');await page.getByRole('searchbox').press('Enter');
 await page.waitForURL(baiduUrl);assert.equal(page.url(),baiduUrl);
 await page.goto(appUrl);await page.getByRole('link',{name:'阿里云',exact:true}).waitFor();
 await page.getByRole('button',{name:'设置',exact:true}).click();
 await page.getByRole('combobox',{name:'书签打开方式'}).selectOption('current');
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('test-names')||'{}')['layout:openInNewTab']===false);
 await page.getByRole('button',{name:'关闭设置'}).click();
 // Delete one of the duplicate-URL bookmarks, with Cancel, Escape and retry coverage.
 await page.getByRole('link',{name:'我的前端文档',exact:true}).hover();
 await page.getByRole('button',{name:'置顶 我的前端文档',exact:true}).click();
 await page.getByRole('link',{name:'我的前端文档',exact:true}).dispatchEvent('auxclick',{button:1});
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('test-names')||'{}')['usage:19']?.count===1);
 await page.getByRole('link',{name:'我的前端文档',exact:true}).hover();
 await page.getByRole('button',{name:'编辑 我的前端文档',exact:true}).click();
 await page.getByRole('button',{name:'删除书签',exact:true}).click();
 await page.getByRole('dialog',{name:'确认删除书签'}).waitFor();
 assert.equal(await page.getByRole('button',{name:'取消删除'}).evaluate(e=>e===document.activeElement),true);
 await page.keyboard.press('Escape');await page.getByRole('dialog',{name:'编辑显示名称'}).waitFor();
 assert.equal(await page.getByRole('link',{name:'我的前端文档',exact:true}).count(),1);
 await page.getByRole('button',{name:'删除书签',exact:true}).click();
 await page.getByRole('button',{name:'取消删除'}).click();
 await page.getByRole('button',{name:'删除书签',exact:true}).click();
 await page.screenshot({path:'/tmp/bookmark-grid-delete-confirmation.png',fullPage:true});
 await page.evaluate(()=>globalThis.__failNextDelete=true);
 await page.getByRole('button',{name:'确认删除',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'Fixture delete failure'}).waitFor();
 await page.getByRole('button',{name:'确认删除',exact:true}).click();
 await page.getByRole('dialog').waitFor({state:'detached'});
 await page.getByText('35 个书签',{exact:true}).waitFor();
 assert.equal(await page.getByRole('link',{name:'我的前端文档',exact:true}).count(),0);
 assert.equal(await page.getByRole('link',{name:'MDN Web Docs',exact:true}).count(),1);
 await page.waitForFunction(()=>{const data=JSON.parse(localStorage.getItem('test-names')||'{}');return !data['name:19']&&!data['usage:19'];});
 await page.reload();await page.getByText('35 个书签',{exact:true}).waitFor();
 const pageCount=context.pages().length;await page.getByRole('link',{name:'阿里云',exact:true}).click();
 await page.waitForURL('https://example-0.test/');assert.equal(context.pages().length,pageCount);
 assert.deepEqual(errors,[]);assert.deepEqual(external,[googleUrl,baiduUrl,'https://example-0.test/']);
 console.log('PASS: site adjacency, aggregate frequency, pinned exception, normalized hosts and search stability; confirmed deletion, Escape/Cancel, retry, duplicate-URL preservation and cleanup; prototype UI verified: readable 28px columns, 32px targets, settings focus exit, persistent save errors/retry/undo and scoped resets; persisted provider/open preferences; intercepted real navigation to Google/Baidu; actual new/current-tab anchor behavior; original tab retained and opener isolated;  production page with mocked Chrome API: 36 bookmarks; default engine / bookmark modes, explicit engine payload, immediate pins, native auxclick counts, stable current ordering and updated order after reload; layout columns/gaps/shared icon-text sizes persist; 12px and 28px dimensions match; reset and responsive cap, duplicate-URL search, alias editing/reload, native modal Escape, desktop/mobile layouts, no unexpected external requests or runtime errors; provider navigation responses intercepted locally.');
}finally{await context?.close();await new Promise(r=>server.close(r));await rm(profile,{recursive:true,force:true});}
