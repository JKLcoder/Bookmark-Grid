import {useCallback,useEffect,useRef,useState} from 'react';
import {backgroundDefaults,backgroundStorageAvailable,loadBackground,replaceBackground,resetBackground,setBackgroundEnabled,setBackgroundShade,subscribeBackground,type LocalBackground} from './background-image';
export function useBackground() {
  const [record,setRecord]=useState<LocalBackground>({...backgroundDefaults});
  const [url,setUrl]=useState('');
  const [operationError,setOperationError]=useState('');
  const [readError,setReadError]=useState('');
  const [imageError,setImageError]=useState('');
  const [busy,setBusy]=useState(false);const [failedKey,setFailedKey]=useState('');
  const [preview,setPreview]=useState<Partial<Pick<LocalBackground,'enabled'|'shade'>>>({});
  const versions=useRef({enabled:0,shade:0});
  const live=useRef(false);const revision=useRef(0);
  const imageUrl=useRef({key:'',url:''});
  const queue=useRef(Promise.resolve());const pending=useRef(0);
  const refresh=useCallback(async()=>{
    const token=++revision.current;
    try{
      const next=await loadBackground();if(!live.current||token!==revision.current)return;
      if(next.imageKey!==imageUrl.current.key){
        const previous=imageUrl.current.url;
        imageUrl.current={key:next.imageKey,url:next.image?URL.createObjectURL(next.image):''};
        setUrl(imageUrl.current.url);setFailedKey('');setImageError('');if(previous)URL.revokeObjectURL(previous);
      }
      setReadError('');setRecord(next);
    }catch{if(live.current&&token===revision.current)setReadError('无法读取本机背景，请重新选择图片或稍后重试。');}
  },[]);
  useEffect(()=>{
    live.current=true;void refresh();const stop=subscribeBackground(()=>void refresh());
    return()=>{live.current=false;revision.current++;stop();if(imageUrl.current.url)URL.revokeObjectURL(imageUrl.current.url);imageUrl.current={key:'',url:''};};
  },[refresh]);
  function run(work:()=>Promise<void>,settled?:()=>void) {
    pending.current++;setBusy(true);setOperationError('');
    queue.current=queue.current.catch(()=>{}).then(work).then(refresh).catch(error=>{if(live.current)setOperationError(error instanceof Error?error.message:'背景保存失败，请重试。');}).finally(()=>{pending.current--;if(live.current){settled?.();setBusy(pending.current>0);}});
  }
  function change<K extends 'enabled'|'shade'>(field:K,value:LocalBackground[K],write:()=>Promise<void>) {
    const token=++versions.current[field];
    setPreview(previous=>({...previous,[field]:value}));
    run(write,()=>{if(versions.current[field]===token)setPreview(previous=>{const next={...previous};delete next[field];return next;});});
  }
  const enabled=preview.enabled??record.enabled;
  return {
    ...record,...preview,url,error:operationError||imageError||readError,busy,hasImage:!!record.image,available:backgroundStorageAvailable(),
    active:enabled&&!!url&&failedKey!==record.imageKey,
    replace:(file:File)=>run(()=>replaceBackground(file)),
    toggle:(enabled:boolean)=>{if(enabled){setFailedKey('');setImageError('');}change('enabled',enabled,()=>setBackgroundEnabled(enabled));},
    shadeTo:(shade:number)=>change('shade',shade,()=>setBackgroundShade(shade)),
    reset:()=>run(resetBackground),
    imageFailed:(key:string)=>{if(key===imageUrl.current.key){setFailedKey(key);setImageError('背景图片无法加载，已显示纯色。请重新选择图片。');}},
  };
}
export type BackgroundController=ReturnType<typeof useBackground>;
