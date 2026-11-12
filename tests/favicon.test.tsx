// @vitest-environment jsdom
import React from 'react';
import {afterEach,it,expect,vi} from 'vitest';
import {render,cleanup,fireEvent} from '@testing-library/react';
import Favicon,{faviconUrl} from '../src/Favicon';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
function runtime(){vi.stubGlobal('chrome',{runtime:{getURL:(path:string)=>`chrome-extension://test-id/${path}`}});}
it('uses the Chrome favicon endpoint with encoded page URL and a crisp scale',()=>{runtime();const url=new URL(faviconUrl('https://example.com/a?q=中文&b=2',20)!);expect(url.origin).toBe('null');expect(url.protocol).toBe('chrome-extension:');expect(url.host).toBe('test-id');expect(url.pathname).toBe('/_favicon/');expect(url.searchParams.get('pageUrl')).toBe('https://example.com/a?q=中文&b=2');expect(url.searchParams.get('size')).toBe('40');});
it('never requests remote icon services and rejects non-web URLs',()=>{runtime();expect(faviconUrl('javascript:alert(1)',16)).toBeNull();expect(faviconUrl('file:///tmp/a',16)).toBeNull();expect(faviconUrl('broken',16)).toBeNull();});
it('falls back without an extension runtime',()=>{vi.stubGlobal('chrome',undefined);const {container}=render(<Favicon url="https://example.com" size={16}/>);expect(container.querySelector('img')).toBeNull();expect(container.querySelector('.bookmark-favicon svg')).toBeTruthy();});
it('uses a decorative icon and a local fallback when loading fails',()=>{runtime();const {container}=render(<Favicon url="https://example.com" size={24}/>);const img=container.querySelector('img')!;expect(img.alt).toBe('');expect(img.getAttribute('referrerpolicy')).toBe('no-referrer');fireEvent.error(img);expect(container.querySelector('img')).toBeNull();expect(container.querySelector('svg')).toBeTruthy();});
