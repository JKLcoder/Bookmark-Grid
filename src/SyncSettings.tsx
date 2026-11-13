import {useEffect,useRef,useState} from 'react';
import {syncRequest,type SyncStatus} from './sync-client';
export default function SyncSettings() {
 const [status,setStatus]=useState<SyncStatus|null>(null);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');
 const file=useRef<HTMLInputElement>(null);
 useEffect(()=>{
  let active=true;
  const refresh=async()=>{try{const stored=await chrome.storage.local.get('sync:status');if(active){const value=stored['sync:status'] as SyncStatus|undefined;setStatus(value&&['pending','accepted','error','unavailable'].includes(value.phase)?value:null);}}catch{if(active)setStatus({phase:'error',error:'无法读取同步状态。'});}};
  const changed=(changes:Record<string,unknown>,area:string)=>{if((!area||area==='local')&&(!changes||changes['sync:status']))void refresh();};
  chrome.storage.onChanged.addListener(changed);void refresh();
  return()=>{active=false;chrome.storage.onChanged.removeListener(changed);};
 },[]);
 async function run(work:()=>Promise<void>){setBusy(true);setMessage('');setError('');try{await work();}catch(e){setError(e instanceof Error?e.message:'操作失败，请重试。');}finally{setBusy(false);}}
 async function exportSettings(){await run(async()=>{const data=await syncRequest({type:'sync:export'});const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const anchor=document.createElement('a');anchor.href=url;anchor.download='bookmark-grid-settings.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage('已生成设置备份，不包含书签树或使用次数。');});}
 async function importSettings(selected:File){await run(async()=>{if(selected.size>2*1024*1024)throw Error('设置文件过大，请选择本插件导出的 JSON。');const data=JSON.parse(await selected.text());await syncRequest({type:'sync:import',data});setMessage('已导入到本机，跨设备进度请查看同步状态。');});}
 const label=!status?'正在读取同步状态…':status.phase==='accepted'?'已交给 Chrome 同步':status.phase==='pending'?'已保存本机，等待同步':status.phase==='unavailable'?'已保存本机，Chrome 同步不可用':'已保存本机，同步待重试';
 return <section className="settings-section" aria-labelledby="sync-section-title">
  <div className="section-header"><h3 id="sync-section-title">跨设备同步</h3></div>
  <p className="sync-state" role="status">{label}</p>
  {status?.error&&<p className="error">{status.error}</p>}
  <p className="helper">同步布局、搜索与打开偏好、置顶和显示名称。同一完整网址共享置顶与名称，使用次数留在本机。</p>
  <p className="helper">需使用同一 Google 账号和扩展 ID，并启用 Chrome 同步。原始书签由 Chrome 的书签同步负责。</p>
  <p className="helper">本插件无法确认其他电脑是否收到；“已交给 Chrome 同步”仅表示 Chrome 已接收设置。</p>
  <div className="sync-actions">
   <button type="button" disabled={busy} onClick={()=>void run(()=>syncRequest({type:'sync:flush'}))}>重试同步</button>
   <button type="button" disabled={busy} onClick={()=>void exportSettings()}>导出设置</button>
   <button type="button" disabled={busy} onClick={()=>file.current?.click()}>导入设置</button>
  </div>
  <input ref={file} type="file" accept="application/json,.json" hidden tabIndex={-1} onChange={event=>{const selected=event.target.files?.[0];event.target.value='';if(selected)void importSettings(selected);}}/>
  <p className="helper">旧版更换扩展 ID 前请先导出，安装正式包后再导入。导入会替换文件中相同项目的设置，不删除书签。</p>
  {message&&<p className="helper" role="status">{message}</p>}
  {error&&<p className="error" role="alert">{error}</p>}
 </section>;
}
