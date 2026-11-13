import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';

const server=createServer(async(req,res)=>{
  try {
    const path=resolve('dist','.'+(new URL(req.url,'http://localhost').pathname==='/'?'/index.html':new URL(req.url,'http://localhost').pathname));
    if(!path.startsWith(resolve('dist')+'/'))throw Error('Invalid path');
    res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html'})[extname(path)]||'application/octet-stream');
    res.end(await readFile(path));
  } catch {res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try {
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/lib/chromium/chromium',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  await context.addInitScript(()=>{
    const event=()=>{const listeners=new Set();return {addListener:f=>listeners.add(f),removeListener:f=>listeners.delete(f),fire:()=>listeners.forEach(f=>f())};};
    const data={};const changed=event();
    const items=Array.from({length:257},(_,i)=>({id:String(i),title:`书签${String(i).padStart(3,'0')}`,url:`https://example.test/${i}`}));
    Object.defineProperty(window,'chrome',{value:{
      bookmarks:{get:async id=>[{id,url:`https://example.test/${id}`}],getTree:async()=>[{id:'0',title:'',children:items}],onCreated:event(),onChanged:event(),onMoved:event(),onRemoved:event()},
      storage:{local:{get:async()=>({...data}),set:async values=>{Object.assign(data,values);changed.fire();},remove:async keys=>{for(const key of [keys].flat())delete data[key];}},onChanged:changed},
      runtime:{sendMessage:(message,callback)=>{window.__service??=import(location.origin+'/service.js').then(m=>m.createService(chrome));window.__service.then(s=>s.request(message)).then(data=>callback({ok:true,data}),error=>callback({ok:false,error:error.message}));}}
    },configurable:true});
  });
  const page=await context.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.getByRole('link',{name:'书签000',exact:true}).waitFor();
  const settled=async()=>{await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));};
  const fits=async()=>{
    await settled();
    const result=await page.evaluate(()=>{
      const viewport=document.querySelector('.bookmark-viewport').getBoundingClientRect();
      const items=[...document.querySelectorAll('.bookmark-item')].map(e=>e.getBoundingClientRect());
      return {height:document.documentElement.scrollHeight,width:document.documentElement.scrollWidth,innerHeight,innerWidth,
        inside:items.every(r=>r.top>=viewport.top-0.5&&r.bottom<=viewport.bottom+0.5),
        footer:document.querySelector('.page-footer').getBoundingClientRect().bottom};
    });
    assert.ok(result.height<=result.innerHeight,JSON.stringify(result));
    assert.ok(result.width<=result.innerWidth,JSON.stringify(result));
    assert.ok(result.inside,'Every displayed row must fit without clipping');
    assert.ok(result.footer<=result.innerHeight,'Footer must remain visible');
  };
  const searchTop=await page.getByRole('searchbox').evaluate(e=>e.getBoundingClientRect().top);
  const all=[];
  do {
    await fits();
    all.push(...await page.getByRole('link').allTextContents());
    assert.equal(await page.getByRole('searchbox').evaluate(e=>e.getBoundingClientRect().top),searchTop);
    if(await page.getByRole('button',{name:'下一页'}).isDisabled())break;
    await page.getByRole('button',{name:'下一页'}).focus();
    await page.keyboard.press('Enter');
  } while(all.length<1000);
  assert.deepEqual(all,Array.from({length:257},(_,i)=>`书签${String(i).padStart(3,'0')}`));
  // A search from the last page must reveal its first result immediately.
  await page.getByRole('combobox',{name:'搜索模式'}).selectOption('bookmarks');
  await page.getByRole('searchbox').fill('书签00');
  assert.equal(await page.getByRole('link').count(),10);
  assert.equal(await page.getByRole('link').first().innerText(),'书签000');
  await page.getByRole('searchbox').fill('不存在');
  await page.getByText('没有找到匹配的书签',{exact:true}).waitFor();
  assert.equal(await page.getByRole('link').count(),0);
  await page.setViewportSize({width:390,height:320});await fits();
  await page.setViewportSize({width:1440,height:900});
  await page.getByRole('searchbox').fill('');
  await page.getByRole('link',{name:'书签000',exact:true}).waitFor();
  for(const viewport of [{width:320,height:480},{width:390,height:844},{width:1440,height:480},{width:650,height:320},{width:1440,height:900}]){
    await page.setViewportSize(viewport);await fits();
    await page.screenshot({path:`/tmp/bookmark-grid-pagination-default-${viewport.width}x${viewport.height}.png`});
    const before=await page.getByRole('link').count();
    await page.getByRole('button',{name:'下一页'}).click();await fits();
    await page.getByRole('button',{name:'设置',exact:true}).click();
    await page.getByRole('slider',{name:'文字与图标大小'}).focus();await page.keyboard.press('End');
    await page.getByRole('slider',{name:'行间距'}).focus();await page.keyboard.press('End');
    await page.getByRole('slider',{name:'列间距'}).focus();await page.keyboard.press('End');
    await page.getByRole('button',{name:'关闭设置'}).click();await fits();
    assert.ok(await page.getByRole('link').count()<=before,'Larger typography must not increase page capacity');
    await page.screenshot({path:`/tmp/bookmark-grid-pagination-${viewport.width}x${viewport.height}.png`});
    await page.getByRole('button',{name:'设置',exact:true}).click();
    await page.getByRole('button',{name:'恢复布局默认'}).click();
    await page.getByRole('button',{name:'关闭设置'}).click();await fits();
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: 257 bookmarks traversed exactly once; search resets, empty results, viewport/typography/gap resizing, desktop/mobile/short windows, stable search position, no page overflow or clipped rows.');
} finally {await browser?.close();await new Promise(r=>server.close(r));}
