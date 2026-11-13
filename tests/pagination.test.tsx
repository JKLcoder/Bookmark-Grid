// @vitest-environment jsdom
import React from 'react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import BookmarkGrid from '../src/BookmarkGrid';
import {DEFAULT_LAYOUT} from '../src/layout';

let height = 96;
let width = 600;
beforeEach(() => {
  height = 96; width = 600;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function(this: HTMLElement) {
    return {width, height: this.classList.contains('bookmark-item') ? 46 : height, top: 0, bottom: height, left:0, right:width, x:0, y:0, toJSON(){}};
  });
});
afterEach(() => {cleanup(); vi.restoreAllMocks();});
const bookmarks = Array.from({length:13}, (_,i)=>({id:String(i),title:`书签${i}`,url:`#${i}`,folderPath:[]}));
const props = {bookmarks, layout:{...DEFAULT_LAYOUT,columns:3}, usage:{},onOpen:vi.fn(),onEdit:vi.fn(),onPin:vi.fn()};
it('fits complete rows and visits every bookmark once across pages', () => {
  render(<BookmarkGrid {...props}/>);
  const seen = screen.getAllByRole('link').map(a=>a.textContent);
  expect(seen).toEqual(['书签0','书签1','书签2','书签3','书签4','书签5']);
  expect((screen.getByRole('button',{name:'上一页'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'下一页'}));
  seen.push(...screen.getAllByRole('link').map(a=>a.textContent));
  fireEvent.click(screen.getByRole('button',{name:'下一页'}));
  seen.push(...screen.getAllByRole('link').map(a=>a.textContent));
  expect(seen).toEqual(bookmarks.map(b=>b.title));
  expect((screen.getByRole('button',{name:'下一页'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'上一页'}));
  expect(screen.getAllByRole('link')[0].textContent).toBe('书签6');
});
it('resets on search changes and clamps after deleting the final page', () => {
  const view=render(<BookmarkGrid {...props} pageKey=""/>);
  fireEvent.click(screen.getByRole('button',{name:'下一页'}));
  fireEvent.click(screen.getByRole('button',{name:'下一页'}));
  view.rerender(<BookmarkGrid {...props} bookmarks={bookmarks.slice(0,12)} pageKey=""/>);
  expect(screen.getAllByRole('link')[0].textContent).toBe('书签6');
  view.rerender(<BookmarkGrid {...props} bookmarks={bookmarks.slice(3,11)} pageKey="search"/>);
  expect(screen.getAllByRole('link')[0].textContent).toBe('书签3');
  view.rerender(<BookmarkGrid {...props} bookmarks={[]} pageKey="none"/>);
  expect(screen.queryByRole('link')).toBeNull();
  expect(screen.queryByRole('navigation')).toBeNull();
});
it('recomputes complete rows and columns after viewport resize', () => {
  render(<BookmarkGrid {...props}/>);
  height=46; width=350;
  act(()=>window.dispatchEvent(new Event('resize')));
  expect(screen.getAllByRole('link').map(a=>a.textContent)).toEqual(['书签0','书签1']);
  height=146; width=600;
  act(()=>window.dispatchEvent(new Event('resize')));
  expect(screen.getAllByRole('link')).toHaveLength(9);
});
