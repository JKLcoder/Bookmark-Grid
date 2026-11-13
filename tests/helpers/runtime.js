import {webcrypto} from 'node:crypto';
import {vi} from 'vitest';
import {createService} from '../../public/service.js';
export function attachRuntime(api) {
 vi.stubGlobal('crypto',webcrypto);
 api.bookmarks??={getTree:async()=>[]};
 const service=createService(api);
 api.runtime??={};
 api.runtime.sendMessage=(message,callback)=>service.request(message).then(data=>callback({ok:true,data}),error=>callback({ok:false,error:error.message}));
 return service;
}
