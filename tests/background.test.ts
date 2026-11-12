import { it, expect, vi } from 'vitest';
it('cleans a deleted subtree while the new-tab page is closed', async()=>{
 let listener: any; const removed: string[][]=[];
 vi.stubGlobal('chrome',{bookmarks:{onRemoved:{addListener:(fn:any)=>listener=fn}},storage:{local:{remove:async(keys:string[])=>{removed.push(keys)}}}});
 await import('../public/background.js');
 listener('folder',{node:{id:'folder',children:[{id:'a'},{id:'nested',children:[{id:'b'}]}]}});
 await Promise.resolve();
 expect(removed).toEqual([['name:folder','name:a','name:nested','name:b']]);
});
