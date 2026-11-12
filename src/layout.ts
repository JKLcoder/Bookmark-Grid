export type SearchEngine='browser'|'baidu'|'google';
export type Layout = {columns:number|'auto';rowGap:number;columnGap:number;itemSize:number;searchEngine:SearchEngine;openInNewTab:boolean};
export const DEFAULT_LAYOUT:Layout={columns:6,rowGap:4,columnGap:12,itemSize:16,searchEngine:'browser',openInNewTab:false};
function bounded(value:unknown,fallback:number,min:number,max:number):number {
 return typeof value==='number'&&Number.isFinite(value)?Math.min(max,Math.max(min,Math.round(value))):fallback;
}
export function normalizeLayout(value:Record<string,unknown>):Layout {
 return {columns:value.columns==='auto'?'auto':bounded(value.columns,6,1,12),rowGap:bounded(value.rowGap,4,0,32),columnGap:bounded(value.columnGap,12,0,48),itemSize:bounded(value.itemSize,16,12,28),searchEngine:value.searchEngine==='baidu'||value.searchEngine==='google'?value.searchEngine:'browser',openInNewTab:value.openInNewTab===true};
}
export function resolveColumns(columns:number|'auto',width:number,gap:number):number {
 const capacity=Math.max(1,Math.floor((width+gap)/(120+gap)));
 return columns==='auto'?Math.max(1,Math.floor((width+gap)/(180+gap))):Math.min(columns,capacity);
}
export async function loadLayout():Promise<Layout> {
 const stored=await chrome.storage.local.get(['layout:columns','layout:rowGap','layout:columnGap','layout:itemSize','layout:searchEngine','layout:openInNewTab']);
 return normalizeLayout({columns:stored['layout:columns'],rowGap:stored['layout:rowGap'],columnGap:stored['layout:columnGap'],itemSize:stored['layout:itemSize'],searchEngine:stored['layout:searchEngine'],openInNewTab:stored['layout:openInNewTab']});
}
export async function saveLayoutField<K extends keyof Layout>(field:K,value:Layout[K]):Promise<void> {
 const safe=normalizeLayout({[field]:value});
 await chrome.storage.local.set({['layout:'+field]:safe[field]});
}
