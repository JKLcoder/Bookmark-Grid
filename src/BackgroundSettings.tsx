import {useRef} from 'react';
import type {BackgroundController} from './useBackground';
export default function BackgroundSettings({background}:{background:BackgroundController}) {
  const file=useRef<HTMLInputElement>(null);
  return <section className="settings-section" aria-labelledby="background-title">
    <div className="section-header"><h3 id="background-title">本机背景</h3></div>
    <p className="helper">图片、开关和遮罩仅保存在当前电脑，不参与跨设备同步或设置备份。</p>
    <div className="background-actions">
      <button type="button" disabled={!background.available||background.busy} onClick={()=>file.current?.click()}>{background.busy?'正在保存…':background.hasImage?'更换背景图片':'选择背景图片'}</button>
      <button type="button" disabled={!background.hasImage||background.busy} onClick={background.reset}>恢复纯色</button>
    </div>
    <input ref={file} data-background-file type="file" accept="image/jpeg,image/png,image/webp" hidden tabIndex={-1} onChange={event=>{const selected=event.target.files?.[0];event.target.value='';if(selected)background.replace(selected);}}/>
    {background.name&&<p className="background-name" title={background.name}>{background.name}</p>}
    <div className="setting-row background-toggle">
      <label htmlFor="background-enabled">启用背景图片</label>
      <input id="background-enabled" type="checkbox" role="switch" checked={background.enabled} disabled={!background.hasImage||background.busy} onChange={event=>background.toggle(event.target.checked)}/>
    </div>
    <div className="setting-row">
      <label htmlFor="background-shade">深色遮罩</label>
      <input id="background-shade" type="range" min="65" max="90" step="1" value={background.shade} disabled={!background.hasImage} onChange={event=>background.shadeTo(Number(event.target.value))}/>
      <output htmlFor="background-shade">{background.shade}%</output>
    </div>
    <p className="helper">JPEG、PNG、WebP，最多 20MB。图片居中铺满并压缩为静态图；较深遮罩用于保持书签文字清楚。</p>
    {!background.available&&<p className="helper">当前浏览器暂不支持保存本机背景。</p>}
    {background.error&&<p className="error" role="alert">{background.error}</p>}
  </section>;
}
