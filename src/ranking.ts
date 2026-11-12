import {sortBookmarks,type Bookmark} from './bookmarks';
import type {UsageMap} from './usage';
export function rankBookmarks(bookmarks:Bookmark[],snapshot:UsageMap,pins:UsageMap):Bookmark[]{
 // Stable sorting retains the existing pinyin/name/ID order for equal usage.
 return sortBookmarks(bookmarks).sort((a,b)=>Number(pins[b.id]?.pinned===true)-Number(pins[a.id]?.pinned===true)
  || (snapshot[b.id]?.count??0)-(snapshot[a.id]?.count??0)
  || (snapshot[b.id]?.lastOpened??0)-(snapshot[a.id]?.lastOpened??0));
}
