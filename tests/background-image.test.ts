import {expect,it} from 'vitest';
import {backgroundDefaults,normalizeBackground,resizeDimensions,validateBackgroundFile} from '../src/background-image';
it('defaults to solid color and clamps the shade to protect readable text',()=>{
 expect(backgroundDefaults.enabled).toBe(false);expect(backgroundDefaults.shade).toBe(75);
 expect(normalizeBackground({shade:5,enabled:true}).shade).toBe(65);
 expect(normalizeBackground({shade:99}).shade).toBe(90);
 expect(normalizeBackground({shade:NaN}).shade).toBe(75);
 expect(normalizeBackground({enabled:true}).enabled).toBe(false);
});
it('fits large images within 2560 pixels without stretching or enlarging small images',()=>{
 expect(resizeDimensions(6000,4000)).toEqual({width:2560,height:1707});
 expect(resizeDimensions(4000,6000)).toEqual({width:1707,height:2560});
 expect(resizeDimensions(640,480)).toEqual({width:640,height:480});
});
it('rejects unsupported, empty, oversized or excessively large images before saving',()=>{
 expect(()=>validateBackgroundFile(new Blob(['svg'],{type:'image/svg+xml'}))).toThrow('JPEG');
 expect(()=>validateBackgroundFile(new Blob([],{type:'image/png'}))).toThrow('为空');
 expect(()=>validateBackgroundFile({type:'image/png',size:21*1024*1024} as Blob)).toThrow('20MB');
 expect(()=>resizeDimensions(12000,12000)).toThrow('尺寸');
 expect(()=>resizeDimensions(0,100)).toThrow('尺寸');
 expect(()=>validateBackgroundFile(new Blob(['png'],{type:'image/png'}))).not.toThrow();
});
it('keeps valid local metadata but disables invalid or missing image records',()=>{
 const image=new Blob(['test'],{type:'image/webp'});
 expect(normalizeBackground({image,imageKey:'unique',name:'我的图片',enabled:true,shade:80})).toMatchObject({image,imageKey:'unique',name:'我的图片',enabled:true,shade:80});
 expect(normalizeBackground({image:new Blob(['x'],{type:'image/svg+xml'}),imageKey:'bad',enabled:true}).enabled).toBe(false);
});
