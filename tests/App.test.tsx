// @vitest-environment jsdom
import React from 'react';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {render,screen,waitFor,cleanup} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App';
let items:any[]; let data:Record<string,string>; let events: Array<Set<()=>void>>;
beforeEach(()=>{
 items=[{id:'a',title:'开发文档',url:'https://react.dev'},{id:'b',title:'中文社区',url:'https://example.com'}]; data={};events=Array.from({length:5},()=>new Set());
 const event=(i:number)=>({addListener:(f:()=>void)=>events[i].add(f),removeListener:(f:()=>void)=>events[i].delete(f)});
 vi.stubGlobal('chrome',{bookmarks:{getTree:async()=>[{id:'0',title:'',children:items}],onCreated:event(0),onChanged:event(1),onMoved:event(2),onRemoved:event(3)},storage:{local:{get:async()=>({...data}),set:async(v:Record<string,string>)=>Object.assign(data,v),remove:async(keys:string|string[])=>{[keys].flat().forEach(k=>delete data[k])}},onChanged:event(4)}});
 HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('renders native anchors and real count',async()=>{render(<App/>);const link=await screen.findByRole('link',{name:/开发文档/});expect(link.getAttribute('href')).toBe('https://react.dev');expect(link.hasAttribute('target')).toBe(false);expect(screen.getByText('2 个书签')).toBeTruthy();});
it('searches and clears without pagination',async()=>{const user=userEvent.setup();render(<App/>);await screen.findByRole('link',{name:/开发文档/});await user.type(screen.getByRole('searchbox'),'react.dev');expect(screen.queryByRole('link',{name:/中文社区/})).toBeNull();await user.click(screen.getByRole('button',{name:'清空搜索'}));expect(screen.getAllByRole('link')).toHaveLength(2);});
it('edits alias without modifying original title and resets it',async()=>{const user=userEvent.setup();render(<App/>);await user.click(await screen.findByRole('button',{name:'编辑 开发文档'}));const input=screen.getByRole('textbox',{name:'显示名称'});await user.clear(input);await user.type(input,'我的文档');await user.click(screen.getByRole('button',{name:'保存名称'}));await screen.findByRole('link',{name:/我的文档/});expect(data['name:a']).toBe('我的文档');expect(items[0].title).toBe('开发文档');await user.click(screen.getByRole('button',{name:'编辑 我的文档'}));await user.click(screen.getByRole('button',{name:'恢复原标题'}));await screen.findByRole('link',{name:/开发文档/});expect(data['name:a']).toBeUndefined();});
it('shows empty bookmarks state',async()=>{items=[];render(<App/>);expect(await screen.findByText('还没有书签')).toBeTruthy();});
it('shows unmatched search state',async()=>{const user=userEvent.setup();render(<App/>);await screen.findByRole('link',{name:/开发文档/});await user.type(screen.getByRole('searchbox'),'不存在');expect(screen.getByText('没有找到匹配的书签')).toBeTruthy();});
it('updates after Chrome events and releases listeners',async()=>{const view=render(<App/>);await screen.findByRole('link',{name:/开发文档/});items=[{id:'c',title:'新增书签',url:'https://new.test'}];events[0].forEach(f=>f());await screen.findByRole('link',{name:/新增书签/});expect(screen.queryByRole('link',{name:/开发文档/})).toBeNull();view.unmount();expect(events.every(e=>e.size===0)).toBe(true);});
it('shows storage errors without claiming success',async()=>{const user=userEvent.setup();chrome.storage.local.set=vi.fn().mockRejectedValue(new Error('空间不足'));render(<App/>);await user.click(await screen.findByRole('button',{name:'编辑 开发文档'}));await user.type(screen.getByRole('textbox',{name:'显示名称'}),'别名');await user.click(screen.getByRole('button',{name:'保存名称'}));await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('空间不足'));expect(screen.getByRole('dialog')).toBeTruthy();});
it('explains missing extension context and allows retry',async()=>{vi.stubGlobal('chrome',undefined);render(<App/>);expect((await screen.findByRole('alert')).textContent).toContain('扩展');expect(screen.getByRole('button',{name:'重试'})).toBeTruthy();});
