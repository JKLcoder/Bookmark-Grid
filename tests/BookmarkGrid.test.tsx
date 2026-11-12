// @vitest-environment jsdom
import React from 'react';
import {afterEach,it,expect,vi} from 'vitest';
import {render,fireEvent,cleanup,screen} from '@testing-library/react';
import BookmarkGrid from '../src/BookmarkGrid';
import {DEFAULT_LAYOUT} from '../src/layout';
afterEach(cleanup);
function setup(){const open=vi.fn();const pin=vi.fn();const edit=vi.fn();render(<BookmarkGrid bookmarks={[{id:'a',title:'网站',url:'#website',folderPath:[]}]} layout={DEFAULT_LAYOUT} usage={{}} onOpen={open} onPin={pin} onEdit={edit}/>);return {open,pin,edit,link:screen.getByRole('link')};}
it('records native left, keyboard and modifier activations once',()=>{const {open,link}=setup();for(const options of [{button:0},{button:0,ctrlKey:true},{button:0,metaKey:true},{button:0,shiftKey:true},{button:0,detail:0}])expect(fireEvent.click(link,options)).toBe(true);expect(open).toHaveBeenCalledTimes(5);});
it('records middle only, not right or non-middle auxiliary clicks',()=>{const {open,link}=setup();fireEvent(link,new MouseEvent('auxclick',{bubbles:true,button:1}));fireEvent(link,new MouseEvent('auxclick',{bubbles:true,button:2}));fireEvent.contextMenu(link);expect(open).toHaveBeenCalledTimes(1);});
it('does not record pin or edit controls as visits',()=>{const {open,pin,edit}=setup();fireEvent.click(screen.getByRole('button',{name:'置顶 网站'}));fireEvent.click(screen.getByRole('button',{name:'编辑 网站'}));expect(pin).toHaveBeenCalledWith('a',true);expect(edit).toHaveBeenCalledTimes(1);expect(open).not.toHaveBeenCalled();});
it('opens bookmarks in a new tab only when configured',()=>{const props={bookmarks:[{id:'a',title:'网站',url:'#website',folderPath:[]}],usage:{},onOpen:vi.fn(),onPin:vi.fn(),onEdit:vi.fn()};const view=render(<BookmarkGrid {...props} layout={{...DEFAULT_LAYOUT,openInNewTab:true}}/>);expect(screen.getByRole('link').getAttribute('target')).toBe('_blank');expect(screen.getByRole('link').getAttribute('rel')).toContain('noopener');view.rerender(<BookmarkGrid {...props} layout={{...DEFAULT_LAYOUT,openInNewTab:false}}/>);expect(screen.getByRole('link').hasAttribute('target')).toBe(false);});
