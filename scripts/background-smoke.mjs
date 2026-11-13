import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
const manifest=JSON.parse(await readFile('public/manifest.json','utf8'));
const server=createServer(async(req,res)=>{try{const path=resolve('dist','.'+(new URL(req.url,'http://localhost').pathname==='/'?'/index.html':new URL(req.url,'http://localhost').pathname));if(!path.startsWith(resolve('dist')+'/'))throw Error();res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html'})[extname(path)]||'application/octet-stream');if(extname(path)==='.html')res.setHeader('Content-Security-Policy',manifest.content_security_policy.extension_pages);res.end(await readFile(path));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/lib/chromium/chromium',headless:true});
const fixture=()=>{
 const event=()=>{const listeners=new Set();return {addListener:f=>listeners.add(f),removeListener:f=>listeners.delete(f),fire:(...args)=>listeners.forEach(f=>f(...args))};};
 const changed=event();const data=JSON.parse(localStorage.getItem('fixture-data')||'{}');
 const items=Array.from({length:180},(_,i)=>({id:String(i),title:`书签${String(i).padStart(3,'0')}`,url:`https://example.test/${i}`}));
 const api={bookmarks:{getTree:async()=>[{id:'0',title:'',children:items}],get:async id=>items.filter(x=>x.id===id),onCreated:event(),onChanged:event(),onMoved:event(),onRemoved:event()},storage:{local:{get:async()=>structuredClone(data),set:async patch=>{Object.assign(data,structuredClone(patch));localStorage.setItem('fixture-data',JSON.stringify(data));changed.fire();},remove:async keys=>{for(const key of [keys].flat())delete data[key];changed.fire();}},sync:{get:async()=>JSON.parse(localStorage.getItem('fixture-cloud')||'{}'),set:async patch=>localStorage.setItem('fixture-cloud',JSON.stringify({...JSON.parse(localStorage.getItem('fixture-cloud')||'{}'),...patch}))},onChanged:changed}};
 let service;api.runtime={sendMessage:(message,callback)=>{service??=import(location.origin+'/service.js').then(m=>m.createService(api));service.then(s=>s.request(message)).then(data=>callback({ok:true,data}),error=>callback({ok:false,error:error.message}));}};
 Object.defineProperty(window,'chrome',{value:api,configurable:true});
 const original=IDBObjectStore.prototype.put;
 IDBObjectStore.prototype.put=function(...args){if(this.name==='background'&&window.__failBackgroundWrite)throw new DOMException('Fixture quota','QuotaExceededError');return original.apply(this,args);};
};
const url=`http://127.0.0.1:${server.address().port}`;
async function context(){const result=await browser.newContext({viewport:{width:1440,height:900}});await result.addInitScript(fixture);return result;}
async function settings(page){if(!await page.getByRole('dialog',{name:'页面设置'}).count())await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByRole('heading',{name:'本机背景',exact:true}).waitFor({timeout:3000});}
const visibleImage=page=>page.waitForFunction(()=>document.querySelector('.app-background img')?.naturalWidth>0&&document.querySelector('main.has-background'));
const geometry=page=>page.evaluate(()=>({search:document.querySelector('.search-wrap').getBoundingClientRect().top,grid:document.querySelector('.bookmark-grid').getBoundingClientRect().top,count:document.querySelectorAll('.bookmark-link').length,scroll:document.documentElement.scrollHeight}));
const errors=[];const external=[];
try{
 const a=await context();const page=await a.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(url))external.push(r.url());});await page.goto(url);await page.getByRole('link').first().waitFor();
 const before=await geometry(page);await settings(page);
 const toggle=page.getByRole('switch',{name:'启用背景图片'});assert.equal(await toggle.isChecked(),false);assert.equal(await toggle.isDisabled(),true);
 const png=Buffer.from(await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=3000;canvas.height=2000;const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,3000,2000);ctx.fillStyle='#7fbde0';ctx.fillRect(0,0,1500,1000);ctx.fillStyle='#cdb2d3';ctx.fillRect(1500,1000,1500,1000);return canvas.toDataURL('image/png').split(',')[1];}),'base64');
 const second=await a.newPage();await second.goto(url);await second.getByRole('link').first().waitFor();
 await page.locator('input[data-background-file]').setInputFiles({name:'测试背景.png',mimeType:'image/png',buffer:png});await visibleImage(page);await visibleImage(second);
 assert.deepEqual(await geometry(page),before,'background must not change search, grid or page capacity');
 assert.deepEqual(await page.locator('.app-background img').evaluate(e=>({width:e.naturalWidth,height:e.naturalHeight})),{width:2560,height:1707});
 await page.getByRole('slider',{name:'深色遮罩'}).fill('80');await page.waitForFunction(()=>getComputedStyle(document.querySelector('.background-shade')).opacity==='0.8');await page.getByRole('button',{name:'更换背景图片',exact:true}).waitFor();
 await page.reload();await visibleImage(page);assert.equal(await page.locator('.background-shade').evaluate(e=>getComputedStyle(e).opacity),'0.8');
 await settings(page);await toggle.uncheck();await page.waitForFunction(()=>!document.querySelector('main.has-background'));await second.waitForFunction(()=>!document.querySelector('main.has-background'));
 await page.reload();await settings(page);assert.equal(await toggle.isChecked(),false);assert.equal(await toggle.isDisabled(),false);await toggle.check();await visibleImage(page);
 const current=await page.locator('.app-background img').getAttribute('src');
 await page.locator('input[data-background-file]').setInputFiles({name:'bad.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});await page.getByRole('alert').filter({hasText:'JPEG'}).waitFor();assert.equal(await page.locator('.app-background img').getAttribute('src'),current);
 await page.locator('input[data-background-file]').setInputFiles({name:'broken.png',mimeType:'image/png',buffer:Buffer.from('not an image')});await page.getByRole('alert').filter({hasText:'无法读取'}).waitFor();assert.equal(await page.locator('.app-background img').getAttribute('src'),current);
 await page.evaluate(()=>window.__failBackgroundWrite=true);await page.locator('input[data-background-file]').setInputFiles({name:'另一个背景.png',mimeType:'image/png',buffer:png});await page.getByRole('alert').filter({hasText:'保存失败'}).waitFor();assert.equal(await page.locator('.app-background img').getAttribute('src'),current);await page.evaluate(()=>window.__failBackgroundWrite=false);
 await page.getByRole('combobox',{name:'期望列数'}).selectOption('4');await page.getByRole('button',{name:'重试同步'}).click();await page.getByText('已交给 Chrome 同步',{exact:true}).waitFor();
 const cloud=await page.evaluate(()=>JSON.parse(localStorage.getItem('fixture-cloud')));assert.deepEqual(Object.keys(cloud),['bg2:settings']);assert.equal(JSON.stringify(cloud).includes('测试背景'),false);
 await page.getByRole('button',{name:'关闭设置'}).click();await page.screenshot({path:'/tmp/bookmark-grid-background-desktop.png'});
 await page.getByRole('button',{name:'下一页'}).click();assert.match(await page.locator('.pagination').innerText(),/第 2 \//);
 await page.getByRole('combobox',{name:'搜索模式'}).selectOption('bookmarks');await page.getByRole('searchbox').fill('书签179');await page.getByRole('link',{name:'书签179',exact:true}).waitFor();await page.getByRole('searchbox').fill('');
 await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.documentElement.scrollHeight<=innerHeight);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'/tmp/bookmark-grid-background-mobile.png'});
 const b=await context();const isolated=await b.newPage();await isolated.goto(url);await settings(isolated);assert.equal(await isolated.getByRole('switch',{name:'启用背景图片'}).isChecked(),false);assert.equal(await isolated.getByRole('switch',{name:'启用背景图片'}).isDisabled(),true);await b.close();
 // Corrupt stored raster bytes exercise image-load fallback, rather than file validation.
 await page.evaluate(()=>new Promise((resolve,reject)=>{const request=indexedDB.open('bookmark-grid-background',1);request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result;const tx=db.transaction('background','readwrite');const store=tx.objectStore('background');const get=store.get('current');get.onsuccess=()=>store.put({...get.result,image:new Blob(['broken'],{type:'image/webp'}),imageKey:'corrupt'},'current');tx.oncomplete=()=>{db.close();resolve();};};}));
 await page.reload();await settings(page);await page.getByRole('alert').filter({hasText:'无法加载'}).waitFor();assert.equal(await page.locator('main.has-background').count(),0);
 await settings(second);await second.locator('input[data-background-file]').setInputFiles({name:'恢复后的图片.png',mimeType:'image/png',buffer:png});await visibleImage(page);
 assert.equal(await page.getByRole('alert').filter({hasText:'无法加载'}).count(),0,'new image from another tab must clear the old load failure');
 await page.getByRole('button',{name:'恢复纯色',exact:true}).click();await second.waitForFunction(()=>!document.querySelector('main.has-background'));await page.reload();await settings(page);assert.equal(await toggle.isDisabled(),true);
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 console.log('PASS: raster upload/compression under CSP, live shade, persistent enable/disable, cross-tab updates, device isolation, invalid/decode/quota failure preservation, corrupt-image fallback, reset, pagination/search geometry and no background data in sync.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
