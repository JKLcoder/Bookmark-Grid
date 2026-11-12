import {it,expect} from 'vitest';
import {rankBookmarks} from '../src/ranking';
const data=['中','阿','波'].map((title,i)=>({id:String(i),title,url:'https://same.test',folderPath:[]}));
it('puts pins before high-frequency bookmarks',()=>{expect(rankBookmarks(data,{'0':{count:99,lastOpened:9,pinned:false}},{'1':{count:0,lastOpened:0,pinned:true}}).map(b=>b.id)).toEqual(['1','0','2']);});
it('orders by count then recency then Chinese name without mutating inputs',()=>{const usage={'0':{count:2,lastOpened:8,pinned:false},'1':{count:2,lastOpened:9,pinned:false},'2':{count:3,lastOpened:1,pinned:false}};expect(rankBookmarks(data,usage,{}).map(b=>b.id)).toEqual(['2','1','0']);expect(data.map(b=>b.id)).toEqual(['0','1','2']);});
it('cold starts by display name and preserves duplicated URLs',()=>{expect(rankBookmarks(data,{},{}).map(b=>b.title)).toEqual(['阿','波','中']);});
it('pin metadata does not change the page frequency snapshot',()=>{const snapshot={'0':{count:1,lastOpened:1,pinned:false}};const latest={'1':{count:99,lastOpened:99,pinned:false}};expect(rankBookmarks(data,snapshot,latest)[0].id).toBe('0');});
