import {it,expect,vi,afterEach} from 'vitest';
import {searchWithDefaultEngine} from '../src/engine-search';
afterEach(()=>vi.unstubAllGlobals());
it('submits trimmed text to the browser default in the current tab',async()=>{const query=vi.fn((_options:any,callback:()=>void)=>callback());vi.stubGlobal('chrome',{search:{query},runtime:{}});await searchWithDefaultEngine('  中文搜索  ');expect(query.mock.calls[0][0]).toEqual({text:'中文搜索',disposition:'CURRENT_TAB'});});
it('ignores blank input without requiring an API',async()=>{vi.stubGlobal('chrome',undefined);await expect(searchWithDefaultEngine('   ')).resolves.toBeUndefined();});
it('reports an unavailable search API',async()=>{vi.stubGlobal('chrome',{});await expect(searchWithDefaultEngine('query')).rejects.toThrow('搜索');});
it('propagates runtime errors and does not choose a fixed provider',async()=>{vi.stubGlobal('chrome',{runtime:{lastError:{message:'disabled'}},search:{query:(_options:any,cb:()=>void)=>cb()}});await expect(searchWithDefaultEngine('query')).rejects.toThrow('disabled');});
