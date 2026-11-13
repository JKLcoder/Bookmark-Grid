import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
const server=createServer(async(req,res)=>{try{const path=resolve('dist','.'+(new URL(req.url,'http://localhost').pathname==='/'?'/index.html':new URL(req.url,'http://localhost').pathname));if(!path.startsWith(resolve('dist')+'/'))throw Error();res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html'})[extname(path)]||'application/octet-stream');res.end(await readFile(path));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/lib/chromium/chromium',headless:true});
const cloud={};const clients=[];let cloudWrites=0;
const fixture=({id,initial})=>{
 const event=()=>{const listeners=new Set();return {addListener:f=>listeners.add(f),removeListener:f=>listeners.delete(f),fire:(...args)=>listeners.forEach(f=>f(...args))};};
 const changed=event();const data=JSON.parse(localStorage.getItem('device-data')||JSON.stringify(initial));
 const nodes=[{id:id+'1',title:'文档',url:'https://example.test/docs?q=1#one'},{id:id+'2',title:'文档副本',url:'https://example.test/docs?q=1#one'},{id:id+'3',title:'另一个查询',url:'https://example.test/docs?q=2#one'}];
 let listener;const onMessage={addListener:f=>listener=f};const alarm=event();
 const api={bookmarks:{getTree:async()=>[{id:'0',title:'',children:nodes}],get:async key=>{const node=nodes.find(n=>n.id===key);if(!node)throw Error('missing');return [node];},onCreated:event(),onChanged:event(),onMoved:event(),onRemoved:event()},storage:{local:{get:async()=>structuredClone(data),set:async values=>{const changes={};for(const [key,value]of Object.entries(values))changes[key]={oldValue:data[key],newValue:value};Object.assign(data,structuredClone(values));localStorage.setItem('device-data',JSON.stringify(data));changed.fire(changes,'local');},remove:async keys=>{const changes={};for(const key of [keys].flat()){changes[key]={oldValue:data[key]};delete data[key];}localStorage.setItem('device-data',JSON.stringify(data));changed.fire(changes,'local');}},sync:{get:()=>window.cloudGet(),set:values=>window.cloudSet(values)},onChanged:changed},runtime:{id:'shared-test-id',onMessage,onStartup:event(),onInstalled:event(),sendMessage:(message,callback)=>worker.then(()=>listener(message,{id:'shared-test-id'},callback))},alarms:{create:()=>{},clear:()=>{},onAlarm:alarm}};
 Object.defineProperty(window,'chrome',{value:api,configurable:true});
 const worker=import(location.origin+'/background.js');
 window.deliverCloud=changes=>changed.fire(changes,'sync');
 window.fireSyncAlarm=()=>alarm.fire({name:'bookmark-grid-sync'});
};
const errors=[];
async function device(id,initial){
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
 const client={context,page:null,offline:false};clients.push(client);
 await context.exposeBinding('cloudGet',()=>{if(client.offline)throw Error('测试：同步暂时不可用');return structuredClone(cloud);});
 await context.exposeBinding('cloudSet',async(source,values)=>{if(client.offline)throw Error('测试：同步暂时不可用');const changes={};for(const [key,value]of Object.entries(values))changes[key]={oldValue:cloud[key],newValue:value};Object.assign(cloud,structuredClone(values));cloudWrites++;for(const c of clients)if(c.page&&!c.offline&&!c.page.isClosed())await c.page.evaluate(changes=>window.deliverCloud(changes),changes);});
 await context.addInitScript(fixture,{id,initial});const page=await context.newPage();client.page=page;page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.getByRole('link').first().waitFor();return client;
}
async function settings(page){if(!await page.getByRole('dialog',{name:'页面设置'}).count())await page.getByRole('button',{name:'设置',exact:true}).click();}
async function flush(page){await settings(page);await page.getByRole('button',{name:'重试同步',exact:true}).click();await page.getByText('已交给 Chrome 同步',{exact:true}).waitFor();}
const local=(page,key)=>page.evaluate(key=>JSON.parse(localStorage.getItem('device-data'))[key],key);
try{
 const a=await device('a',{'name:a1':'旧名称','usage:a1':{count:9,lastOpened:1,pinned:true},'layout:rowGap':7});
 await settings(a.page);await a.page.getByRole('combobox',{name:'期望列数'}).selectOption('8');await flush(a.page);
 const b=await device('b',{'name:b1':'乙电脑旧名称','usage:b1':{pinned:true},'layout:columns':3});
 await b.page.waitForFunction(()=>JSON.parse(localStorage.getItem('device-data'))['name:b2']==='旧名称');
 assert.equal(await local(b.page,'layout:columns'),8);assert.equal((await local(b.page,'usage:b1')).count,undefined);
 assert.equal(await b.page.locator('[data-bookmark-id="b3"] .pin-button').getAttribute('aria-pressed'),'false');
 await settings(b.page);await b.page.getByRole('combobox',{name:'网页搜索引擎'}).selectOption('google');await flush(b.page);
 await a.page.waitForFunction(()=>JSON.parse(localStorage.getItem('device-data'))['layout:searchEngine']==='google');
 await b.page.getByRole('button',{name:'关闭设置'}).click();await b.page.locator('[data-bookmark-id="b1"] .bookmark-link').hover();await b.page.locator('[data-bookmark-id="b1"] .pin-button').click();await flush(b.page);
 await a.page.waitForFunction(()=>document.querySelector('[data-bookmark-id="a1"] .pin-button').getAttribute('aria-pressed')==='false');
 assert.equal(await a.page.locator('[data-bookmark-id="a2"] .pin-button').getAttribute('aria-pressed'),'false');
 const downloadPromise=a.page.waitForEvent('download');await a.page.getByRole('button',{name:'导出设置'}).click();const downloaded=await downloadPromise;const backup=JSON.parse(await readFile(await downloaded.path(),'utf8'));
 assert.equal(backup.format,'bookmark-grid-settings');assert.equal(JSON.stringify(backup).includes('lastOpened'),false);
 a.offline=true;await a.page.getByRole('slider',{name:'行间距'}).fill('12');await a.page.getByRole('button',{name:'重试同步'}).click();await a.page.getByText('已保存本机，同步待重试',{exact:true}).waitFor();
 await a.page.reload();await settings(a.page);assert.equal(await a.page.getByRole('slider',{name:'行间距'}).inputValue(),'12');
 await b.page.getByRole('slider',{name:'列间距'}).fill('20');await flush(b.page);
 a.offline=false;await a.page.evaluate(()=>window.fireSyncAlarm());await a.page.getByText('已交给 Chrome 同步',{exact:true}).waitFor();
 await b.page.waitForFunction(()=>JSON.parse(localStorage.getItem('device-data'))['layout:rowGap']===12);
 assert.equal(await local(a.page,'layout:columnGap'),20);assert.equal((await local(a.page,'usage:a1')).count,9);
 await b.page.locator('input[type="file"]').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"format":"bad"}')});await b.page.getByRole('alert').filter({hasText:'设置备份'}).waitFor();
 await b.page.locator('input[type="file"]').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await b.page.getByText('已导入到本机，跨设备进度请查看同步状态。',{exact:true}).waitFor();await flush(b.page);
 await a.page.waitForFunction(()=>JSON.parse(localStorage.getItem('device-data'))['layout:rowGap']===7);
 await b.page.setViewportSize({width:390,height:844});await b.page.getByRole('button',{name:'导出设置'}).scrollIntoViewIfNeeded();
 assert.equal(await b.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await b.page.screenshot({path:'/tmp/bookmark-grid-sync-settings-mobile.png'});
 assert.deepEqual(errors,[]);assert.ok(cloudWrites>0);
 console.log('PASS: production worker/router with two isolated browser profiles; legacy migration, distinct bookmark IDs, duplicate URL pins/names, local-only counts, live remote updates, offline restart + alarm retry, export/download/import, malformed-file recovery and mobile settings.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
