import { describe, it, expect } from 'vitest';
import { flattenBookmarks, displayName, searchBookmarks, sortBookmarks, pruneNames } from '../src/bookmarks';
const leaf = (id: string, title = '原始标题', url = 'https://example.com/docs') => ({ id, title, url });
const tree = [{ id: '0', title: '', children: [{ id: '1', title: '收藏夹', children: [leaf('a'), { id: '2', title: '学习', children: [leaf('b')] }, { id: '3', title: '空目录', children: [] }] }] }];
describe('bookmark data', () => {
 it('reads a single level', () => expect(flattenBookmarks([leaf('a')])).toEqual([{...leaf('a'), folderPath: []}]));
 it('keeps nested folder paths and ignores folders', () => expect(flattenBookmarks(tree).map(b => b.folderPath)).toEqual([['收藏夹'], ['收藏夹','学习']]));
 it('handles empty folders', () => expect(flattenBookmarks([{ id:'1', title:'空', children:[] }])).toEqual([]));
 it('preserves duplicate URLs by id', () => expect(flattenBookmarks(tree).map(b=>b.id)).toEqual(['a','b']));
 it('handles an empty tree', () => expect(flattenBookmarks([])).toEqual([]));
 it('uses custom names without altering original title', () => { const b = {...leaf('a'), folderPath:[], customName:'别名'}; expect(displayName(b)).toBe('别名'); expect(b.title).toBe('原始标题'); });
 it('reflects changed original title only without alias', () => { expect(displayName({...leaf('a','新标题'),folderPath:[]})).toBe('新标题'); expect(displayName({...leaf('a','新标题'),folderPath:[],customName:'别名'})).toBe('别名'); });
 it('falls back to URL for blank titles', () => expect(displayName({...leaf('a',''),folderPath:[]})).toBe('https://example.com/docs'));
 it.each(['别名','原始标题','https://example.com','EXAMPLE.COM','学习'])('searches field %s', q => { const b = {...leaf('a'),folderPath:['学习'],customName:'别名'}; expect(searchBookmarks([b],q)).toEqual([b]); });
 it('clearing search restores all bookmarks', () => expect(searchBookmarks(flattenBookmarks(tree),'  ')).toHaveLength(2));
 it('sorts Chinese by pinyin and uses custom display name', () => { const data = ['中','波','阿'].map((title,i)=>({...leaf(String(i),title),folderPath:[]})); expect(sortBookmarks(data).map(displayName)).toEqual(['阿','波','中']); expect(data[0].title).toBe('中'); });
 it('prunes aliases of removed bookmarks including descendants', () => expect(pruneNames({a:'A',b:'B',removed:'R'},flattenBookmarks(tree))).toEqual({a:'A',b:'B'}));
});
