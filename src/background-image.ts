export interface LocalBackground {
  image?: Blob;
  imageKey: string;
  name: string;
  enabled: boolean;
  shade: number;
}
export const backgroundDefaults: LocalBackground = {imageKey:'',name:'',enabled:false,shade:75};
const formats=['image/jpeg','image/png','image/webp'];
const maxStoredBytes=2*1024*1024;
export function normalizeBackground(value: Partial<LocalBackground> | null | undefined): LocalBackground {
  const valid=value?.image instanceof Blob&&formats.includes(value.image.type)&&value.image.size>0&&value.image.size<=maxStoredBytes&&typeof value.imageKey==='string'&&!!value.imageKey;
  return {image:valid?value.image:undefined,imageKey:valid?value.imageKey!:'',name:valid&&typeof value.name==='string'?value.name.slice(0,120):'',enabled:valid&&value.enabled===true,shade:typeof value?.shade==='number'&&Number.isFinite(value.shade)?Math.min(90,Math.max(65,Math.round(value.shade))):75};
}
export function validateBackgroundFile(file: Blob) {
  if(!formats.includes(file.type))throw Error('请选择 JPEG、PNG 或 WebP 图片。');
  if(!file.size)throw Error('图片文件为空，请重新选择。');
  if(file.size>20*1024*1024)throw Error('图片不能超过 20MB，请选择较小的图片。');
}
export function resizeDimensions(width:number,height:number) {
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||width*height>32_000_000)throw Error('图片尺寸过大或无效，请选择 3200 万像素以内的图片。');
  const scale=Math.min(1,2560/Math.max(width,height));
  return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};
}
async function prepareImage(file:File):Promise<Blob> {
  validateBackgroundFile(file);
  let bitmap:ImageBitmap;
  try{bitmap=await createImageBitmap(file);}catch{throw Error('无法读取这张图片，请选择有效的 JPEG、PNG 或 WebP 文件。');}
  try{
    const {width,height}=resizeDimensions(bitmap.width,bitmap.height);
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const context=canvas.getContext('2d');if(!context)throw Error('当前浏览器无法处理背景图片。');
    context.fillStyle='#191d20';context.fillRect(0,0,width,height);context.drawImage(bitmap,0,0,width,height);
    for(const quality of [0.85,0.7,0.55]){
      const image=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/webp',quality));
      if(image&&image.size<=maxStoredBytes)return image;
    }
    throw Error('处理后的图片仍超过 2MB，请选择较小或更简洁的图片。');
  }finally{bitmap.close();}
}
const databaseName='bookmark-grid-background';
const eventName='bookmark-grid-background-change';
let connection:Promise<IDBDatabase>|undefined;
export const backgroundStorageAvailable=()=>typeof indexedDB!=='undefined';
function openDatabase():Promise<IDBDatabase> {
  if(!backgroundStorageAvailable())return Promise.reject(Error('当前浏览器无法保存本机背景。'));
  if(!connection)connection=new Promise<IDBDatabase>((resolve,reject)=>{
    const request=indexedDB.open(databaseName,1);let failed=false;
    request.onupgradeneeded=()=>{request.result.createObjectStore('background');};
    request.onblocked=()=>{failed=true;reject(Error('背景存储被其他旧标签页占用，请关闭旧标签页后重试。'));};
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{const db=request.result;if(failed){db.close();return;}db.onversionchange=()=>{db.close();connection=undefined;};resolve(db);};
  }).catch(error=>{connection=undefined;throw error;});
  return connection;
}
export async function loadBackground():Promise<LocalBackground> {
  if(!backgroundStorageAvailable())return {...backgroundDefaults};
  const db=await openDatabase();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('background','readonly');const request=tx.objectStore('background').get('current');
    tx.oncomplete=()=>resolve(normalizeBackground(request.result));
    tx.onabort=()=>reject(tx.error??Error('无法读取本机背景。'));
    tx.onerror=()=>reject(tx.error??Error('无法读取本机背景。'));
  });
}
function announceChange() {
  window.dispatchEvent(new Event(eventName));
  if(typeof BroadcastChannel!=='undefined'){const channel=new BroadcastChannel(eventName);channel.postMessage('changed');channel.close();}
}
export function subscribeBackground(listener:()=>void) {
  window.addEventListener(eventName,listener);
  const channel=typeof BroadcastChannel==='undefined'?null:new BroadcastChannel(eventName);
  if(channel)channel.onmessage=listener;
  return()=>{window.removeEventListener(eventName,listener);channel?.close();};
}
async function updateBackground(update:(current:LocalBackground)=>LocalBackground|undefined) {
  try{
    const db=await openDatabase();
    await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction('background','readwrite');const store=tx.objectStore('background');const get=store.get('current');
      tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error??Error('事务已取消。'));tx.onerror=()=>reject(tx.error??Error('事务失败。'));
      get.onsuccess=()=>{try{const next=update(normalizeBackground(get.result));if(next)store.put(next,'current');else store.delete('current');}catch(error){tx.abort();reject(error);}};
    });
  }catch(error){throw Error(error instanceof DOMException&&error.name==='QuotaExceededError'?'背景保存失败：存储空间不足，请释放空间后重试。':'背景保存失败，请重试。');}
  announceChange();
}
export async function replaceBackground(file:File) {
  const image=await prepareImage(file);
  await updateBackground(current=>({...current,image,imageKey:crypto.randomUUID(),name:file.name.slice(0,120),enabled:true}));
}
export const setBackgroundEnabled=(enabled:boolean)=>updateBackground(current=>({...current,enabled:enabled&&!!current.image}));
export const setBackgroundShade=(shade:number)=>updateBackground(current=>({...current,shade:normalizeBackground({shade}).shade}));
export const resetBackground=()=>updateBackground(()=>undefined);
