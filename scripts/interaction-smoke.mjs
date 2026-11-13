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
  }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/lib/chromium/chromium',headless:true});
const fixture=()=>{
  const event=()=>{const listeners=new Set();return {addListener:f=>listeners.add(f),removeListener:f=>listeners.delete(f),fire:()=>listeners.forEach(f=>f())};};
  const data={};const changed=event();
  const items=Array.from({length:160},(_,i)=>({id:String(i),title:`书签${String(i).padStart(3,'0')}`,url:`https://example.test/${i}`}));
  const api={bookmarks:{getTree:async()=>{if(window.__delayRefresh)await new Promise(r=>setTimeout(r,200));return [{id:'0',title:'',children:items}];},get:async id=>{const item=items.find(x=>x.id===id);if(!item)throw Error('missing');return [item];},onCreated:event(),onChanged:event(),onMoved:event(),onRemoved:event()},storage:{local:{get:async()=>({...data}),set:async values=>{if(window.__failPreferences&&Object.keys(values).some(k=>k.startsWith('layout:')))throw Error('测试：保存失败');Object.assign(data,values);changed.fire();},remove:async keys=>{for(const key of [keys].flat())delete data[key];changed.fire();}},onChanged:changed}};
  let store;
  api.runtime={sendMessage:(message,callback)=>{store??=import(location.origin+'/service.js').then(m=>m.createService(api));store.then(service=>message.type==='usage:pin'&&window.__failPin?Promise.reject(Error('测试：置顶保存失败')):service.request(message)).then(data=>callback({ok:true,data}),error=>callback({ok:false,error:error.message}));}};
  api.bookmarks.remove=async id=>{const index=items.findIndex(x=>x.id===id);if(index<0)throw Error('missing');items.splice(index,1);api.bookmarks.onRemoved.fire();(await store).usage.remove([id]);};
  Object.defineProperty(window,'chrome',{value:api,configurable:true});
};
const failures=[];
async function check(name,run){
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const errors=[];
  try{
    await context.addInitScript(fixture);
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByRole('link',{name:'书签000',exact:true}).waitFor();
    await run(page);assert.deepEqual(errors,[]);console.log(`PASS: ${name}`);
  }catch(error){failures.push(error);console.error(`FAIL: ${name}: ${error.message}`);}
  finally{await context.close();}
}
const settled=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const focusIs=(page,selector)=>page.locator(selector).evaluate(e=>e===document.activeElement);
try{
  await check('save error leaves pager visible and clickable while retry/undo remain usable',async page=>{
    await page.getByRole('button',{name:'设置',exact:true}).click();
    await page.evaluate(()=>window.__failPreferences=true);
    await page.getByRole('combobox',{name:'期望列数'}).selectOption('8');
    await page.getByRole('alert').waitFor();
    await page.getByRole('button',{name:'关闭设置'}).click();await settled(page);
    const uncovered=await page.getByRole('button',{name:'下一页'}).evaluate(e=>{const r=e.getBoundingClientRect();return r.bottom<=innerHeight&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));});
    assert.equal(uncovered,true,'save error must not cover pagination');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight),true);
    await page.screenshot({path:'/tmp/bookmark-grid-save-error-inline.png'});
    await page.getByRole('button',{name:'下一页'}).click();
    assert.match(await page.locator('.pagination').innerText(),/第 2 \//);
    await page.getByRole('button',{name:'重试保存'}).click();await page.getByRole('alert').waitFor();
    await page.evaluate(()=>window.__failPreferences=false);
    await page.getByRole('button',{name:'撤销未保存更改'}).click();
    await page.getByRole('alert').waitFor({state:'detached'});
    await page.getByRole('button',{name:'设置',exact:true}).click();
    assert.equal(await page.getByRole('combobox',{name:'期望列数'}).inputValue(),'6');
    await page.getByRole('button',{name:'关闭设置'}).click();
    await page.screenshot({path:'/tmp/bookmark-grid-feedback-recovered.png'});
  });
  await check('cross-page pin announces success, retains a usable focus and can reveal the pinned item',async page=>{
    await page.getByRole('button',{name:'下一页'}).click();
    const itemName=await page.getByRole('link').first().innerText();
    await page.getByRole('link').first().focus();
    await page.getByRole('button',{name:`置顶 ${itemName}`,exact:true}).focus();await page.keyboard.press('Enter');
    await page.getByRole('status').filter({hasText:'已置顶'}).waitFor({timeout:3000});
    assert.match(await page.locator('.pagination').innerText(),/第 2 \//);
    const view=page.getByRole('button',{name:'查看已置顶书签'});
    assert.equal(await view.evaluate(e=>e===document.activeElement),true);
    await page.keyboard.press('Enter');
    const pin=page.getByRole('button',{name:`取消置顶 ${itemName}`,exact:true});
    await pin.waitFor();assert.equal(await pin.evaluate(e=>e===document.activeElement),true);
    assert.match(await page.locator('.pagination').innerText(),/第 1 \//);
    assert.equal(await page.getByRole('link').first().innerText(),itemName);
    await page.screenshot({path:'/tmp/bookmark-grid-pin-revealed.png'});
    await page.keyboard.press('Enter');
    await page.getByRole('status').filter({hasText:'已取消置顶'}).waitFor();
    await page.getByRole('button',{name:'查看已取消置顶书签'}).click();
    await page.getByRole('button',{name:`置顶 ${itemName}`,exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:`置顶 ${itemName}`,exact:true}).evaluate(e=>e===document.activeElement),true);
    await page.evaluate(()=>window.__failPin=true);
    await page.keyboard.press('Enter');
    await page.getByRole('alert').filter({hasText:'置顶保存失败'}).waitFor();
    assert.equal(await page.getByRole('status').filter({hasText:/已.*置顶/}).count(),0,'failed pin must not leave a stale success message');
  });
  await check('rename focuses input, cancel restores the edit control, delete cancel is safe and deletion restores a neighbor',async page=>{
    await page.getByRole('link').first().focus();
    const edit=page.getByRole('button',{name:'编辑 书签000',exact:true});
    await edit.focus();await page.keyboard.press('Enter');
    await page.getByRole('dialog',{name:'编辑显示名称'}).waitFor();
    assert.equal(await focusIs(page,'#display-name'),true,'rename input must receive initial focus');
    await page.keyboard.press('Escape');
    assert.equal(await edit.evaluate(e=>e===document.activeElement),true);
    await page.keyboard.press('Enter');
    await page.getByRole('button',{name:'删除书签',exact:true}).click();
    assert.equal(await page.getByRole('button',{name:'取消删除'}).evaluate(e=>e===document.activeElement),true);
    await page.keyboard.press('Escape');
    assert.equal(await focusIs(page,'#display-name'),true);
    await page.getByRole('textbox',{name:'显示名称'}).fill('书签000 新名字');
    await page.getByRole('button',{name:'保存名称',exact:true}).click();
    const renamed=page.getByRole('button',{name:'编辑 书签000 新名字',exact:true});
    await renamed.waitFor();assert.equal(await renamed.evaluate(e=>e===document.activeElement),true);
    await page.keyboard.press('Enter');
    await page.getByRole('button',{name:'删除书签',exact:true}).click();
    await page.getByRole('button',{name:'确认删除',exact:true}).click();
    await page.getByRole('dialog').waitFor({state:'detached'});await settled(page);
    assert.equal(await page.getByRole('link').first().evaluate(e=>e===document.activeElement),true);
    assert.equal(await page.getByRole('link',{name:'书签000 新名字',exact:true}).count(),0);
  });

  await check('rename restores focus even when delayed refresh moves the bookmark to another page',async page=>{
    await page.getByRole('link').first().focus();
    await page.getByRole('button',{name:'编辑 书签000',exact:true}).click();
    await page.evaluate(()=>window.__delayRefresh=true);
    await page.getByRole('textbox',{name:'显示名称'}).fill('最后一条书签');
    await page.getByRole('button',{name:'保存名称',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('.bookmark-link')?.textContent!=='书签000');
    await settled(page);
    const edit=page.getByRole('button',{name:'编辑 最后一条书签',exact:true});
    assert.equal(await edit.count(),1,'renamed item should be revealed on its new page');
    assert.equal(await edit.evaluate(e=>e===document.activeElement),true);
  });
}finally{await browser.close();await new Promise(r=>server.close(r));}
if(failures.length)throw new AggregateError(failures,'Interaction regressions failed');
