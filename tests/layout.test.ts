import {it,expect,beforeEach,vi} from 'vitest';
import {DEFAULT_LAYOUT, normalizeLayout, resolveColumns, loadLayout, saveLayoutField} from '../src/layout';
beforeEach(()=>vi.stubGlobal('chrome',{storage:{local:{get:async()=>({'layout:columns':8,'layout:rowGap':2,'layout:columnGap':10}),set:vi.fn(async()=>{})}}}));
it('defaults to compact six-column layout',()=>expect(normalizeLayout({})).toEqual({columns:6,rowGap:4,columnGap:12}));
it('bounds invalid persisted settings and accepts auto',()=>{expect(normalizeLayout({columns:99,rowGap:-1,columnGap:100})).toEqual({columns:12,rowGap:0,columnGap:48});expect(normalizeLayout({columns:'auto',rowGap:NaN,columnGap:'bad'})).toEqual({...DEFAULT_LAYOUT,columns:'auto'});});
it('caps columns for narrow screens and supports auto',()=>{expect(resolveColumns(6,390,12)).toBe(3);expect(resolveColumns(6,342,12)).toBe(2);expect(resolveColumns(6,1440,12)).toBe(6);expect(resolveColumns('auto',1440,12)).toBe(7);expect(resolveColumns(12,80,48)).toBe(1);});
it('loads layout keys without touching aliases',async()=>expect(await loadLayout()).toEqual({columns:8,rowGap:2,columnGap:10}));
it('writes only the changed field',async()=>{await saveLayoutField('rowGap',6);expect(chrome.storage.local.set).toHaveBeenCalledWith({'layout:rowGap':6});});
it('propagates save failures',async()=>{chrome.storage.local.set=vi.fn().mockRejectedValue(new Error('quota'));await expect(saveLayoutField('columns',8)).rejects.toThrow('quota');});
