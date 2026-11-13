import { chromium } from 'playwright';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
const profile = await mkdtemp(join(tmpdir(), 'bookmark-grid-smoke-'));
const extension = resolve('dist');
let context;
try {
 context = await chromium.launchPersistentContext(profile, {
  executablePath: process.env.CHROMIUM_PATH || '/usr/lib/chromium/chromium',
  headless: true,
  ignoreDefaultArgs: ['--disable-extensions'],
  env: {...process.env, XDG_CACHE_HOME: join(profile,'cache'), XDG_CONFIG_HOME: join(profile,'config')},
  args: [`--disable-extensions-except=${extension}`,`--load-extension=${extension}`],
  viewport: {width:1440,height:1000}
 });
 let worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
 const extensionId = new URL(worker.url()).host;
 const url = `chrome-extension://${extensionId}/index.html`;
 const fixture = await worker.evaluate(async()=>{
  const roots = await chrome.bookmarks.getTree();
  const parentId = roots[0].children[0].id;
  const folder=await chrome.bookmarks.create({parentId,title:'测试收藏'});
  const nested=await chrome.bookmarks.create({parentId:folder.id,title:'前端开发'});
  const a=await chrome.bookmarks.create({parentId:nested.id,title:'React 文档',url:'https://react.dev/'});
  const b=await chrome.bookmarks.create({parentId:folder.id,title:'重复网址',url:'https://react.dev/'});
  let liveId;
  for (const [title,url] of [['阿里云','https://aliyun.com'],['百度','https://baidu.com'],['中文社区','https://example.com'],['TypeScript Handbook','https://typescriptlang.org/docs'],['GitHub','https://github.com'],['MDN Web Docs','https://developer.mozilla.org'],['Vite','https://vite.dev'],['设计灵感与非常非常长的书签标题用来验证文字溢出时不会破坏网格布局','https://design.example.com'],['知乎','https://zhihu.com'],['Figma','https://figma.com'],['Linear','https://linear.app'],['Notion','https://notion.so']]) {const created=await chrome.bookmarks.create({parentId:folder.id,title,url});if(title==='阿里云')liveId=created.id;}
  return {folder,a,b,liveId};
 });
 const page = await context.newPage(); const errors=[]; const external=[];
 const named=page.locator(`[data-bookmark-id="${fixture.a.id}"] .bookmark-link`);
 const duplicate=page.locator(`[data-bookmark-id="${fixture.b.id}"]`);
 page.on('pageerror',error=>errors.push(error.message));
 page.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url());});
 await page.goto(url);
 await page.getByRole('link',{name:'React 文档',exact:true}).waitFor();
 assert.equal(await page.getByRole('link').count(),14);
 await page.getByRole('combobox',{name:'搜索模式'}).selectOption('bookmarks');
 await page.getByRole('searchbox').fill('前端开发');
 assert.equal(await page.getByRole('link').count(),1);
 await page.getByRole('button',{name:'清空搜索'}).click();
 await page.getByRole('link',{name:'React 文档',exact:true}).hover();
 await page.getByRole('button',{name:'编辑 React 文档',exact:true}).click();
 await page.getByRole('textbox',{name:'显示名称'}).fill('我的前端文档');
 await page.getByRole('button',{name:'保存名称',exact:true}).click();
 await named.waitFor();
 await page.reload();
 await named.waitFor();
 assert.equal(await worker.evaluate(async id=>(await chrome.bookmarks.get(id))[0].title,fixture.a.id),'React 文档');
 await worker.evaluate(async id=>chrome.bookmarks.update(id,{title:'更新原始标题'}),fixture.liveId);
 await page.getByRole('link',{name:'更新原始标题',exact:true}).waitFor();
 await page.getByRole('button',{name:'设置',exact:true}).click();
 await page.getByRole('dialog').waitFor();
 await page.keyboard.press('Escape');
 assert.equal(await page.getByRole('dialog').count(),0);
 await page.screenshot({path:'/tmp/bookmark-grid-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
 await page.screenshot({path:'/tmp/bookmark-grid-mobile.png',fullPage:true});
 assert.deepEqual(external,[],'Extension page must not make external requests');
 assert.deepEqual(errors,[],'No browser runtime errors');
 await page.setViewportSize({width:1440,height:1000});
 await duplicate.locator('.bookmark-link').hover();
 await duplicate.locator('.edit-button').click();
 await page.getByRole('button',{name:'删除书签',exact:true}).click();
 await page.getByRole('button',{name:'确认删除',exact:true}).click();
 await page.getByRole('dialog').waitFor({state:'detached'});
 await page.getByText('13 个书签',{exact:true}).waitFor();
 assert.equal(await worker.evaluate(async id=>{try{await chrome.bookmarks.get(id);return false;}catch{return true;}},fixture.b.id),true);
 assert.equal(await named.count(),1);
 await page.close();
 await worker.evaluate(async id=>chrome.bookmarks.removeTree(id),fixture.folder.id);
 // A real storage read checks cleanup even while all extension pages are closed.
 for(let attempt=0;attempt<40;attempt++){
  const stored=await worker.evaluate(async()=>chrome.storage.local.get(null));
  if(!stored[`name:${fixture.a.id}`])break;
  if(attempt===39)throw new Error('Background alias cleanup timed out');
  await new Promise(resolve=>setTimeout(resolve,50));
 }
 const empty=await context.newPage();await empty.goto(url);await empty.getByText('还没有书签',{exact:true}).waitFor();
 console.log('PASS: real unpacked MV3 extension; 14 bookmarks; nested search; aliases survive reload; original titles preserved; live updates; dialog Escape; 390px layout; zero external page requests; background deletion cleanup; empty state.');
} finally {
 await context?.close();await rm(profile,{recursive:true,force:true});
}
