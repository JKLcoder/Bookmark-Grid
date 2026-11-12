import {useEffect,useRef,useState} from 'react';
import {Cross2Icon} from '@radix-ui/react-icons';
import {DEFAULT_LAYOUT,saveLayoutField,type Layout} from './layout';
export default function LayoutSettings({layout,onChange,onClose}:{layout:Layout;onChange:(layout:Layout)=>void;onClose:()=>void}) {
 const ref=useRef<HTMLDivElement>(null);
 const [error,setError]=useState('');
 const queue=useRef(Promise.resolve());
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null;
  ref.current?.querySelector('select')?.focus();
  function key(event:KeyboardEvent){if(event.key==='Escape'){event.preventDefault();onClose();}}
  function outside(event:PointerEvent){if(!ref.current?.contains(event.target as Node)&&!(event.target as Element).closest('[aria-label="设置"]'))onClose();}
  document.addEventListener('keydown',key);document.addEventListener('pointerdown',outside);
  return ()=>{document.removeEventListener('keydown',key);document.removeEventListener('pointerdown',outside);previous?.focus();};
 },[onClose]);
 function update<K extends keyof Layout>(field:K,value:Layout[K]){
  onChange({...layout,[field]:value});setError('');
  queue.current=queue.current.catch(()=>{}).then(()=>saveLayoutField(field,value)).catch(error=>setError(`保存失败：${error instanceof Error?error.message:'请重试'}。再次调整可重试。`));
 }
 function reset(){onChange({...DEFAULT_LAYOUT});setError('');queue.current=queue.current.catch(()=>{}).then(async()=>{for(const field of ['columns','rowGap','columnGap','itemSize'] as const)await saveLayoutField(field,DEFAULT_LAYOUT[field]);}).catch(error=>setError(`保存失败：${error instanceof Error?error.message:'请重试'}`));}
 return <div ref={ref} className="layout-settings" role="dialog" aria-labelledby="layout-title" id="layout-settings">
  <div className="dialog-heading"><h2 id="layout-title">网格布局</h2><button className="icon-button" aria-label="关闭设置" onClick={onClose}><Cross2Icon/></button></div>
  <div className="setting-row"><label htmlFor="columns">列数</label><select id="columns" value={layout.columns} onChange={e=>update('columns',e.target.value==='auto'?'auto':Number(e.target.value))}><option value="auto">自动</option>{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{i+1} 列</option>)}</select></div>
  {(['rowGap','columnGap'] as const).map(field=><div className="setting-row" key={field}><label htmlFor={field}>{field==='rowGap'?'行间距':'列间距'}</label><input id={field} type="range" min="0" max={field==='rowGap'?32:48} step="1" value={layout[field]} onChange={e=>update(field,Number(e.target.value))}/><output htmlFor={field}>{layout[field]} px</output></div>)}
  <div className="setting-row size-setting"><label htmlFor="itemSize">文字与图标大小</label><input id="itemSize" type="range" min="12" max="28" step="1" value={layout.itemSize} onChange={e=>update('itemSize',Number(e.target.value))}/><output htmlFor="itemSize">{layout.itemSize} px</output></div>
  <p className="muted">窄屏自动减少列数。</p>{error&&<p role="alert" className="error">{error}</p>}
  <div className="settings-footer"><span>仅保存在本机</span><button onClick={reset}>恢复默认</button></div>
 </div>;
}
