/** Exact historical pixel pipeline against current production factory. Deletes temporary modules afterward. */
import {chromium} from '@playwright/test';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {writeFile,readFile,unlink} from 'node:fs/promises';
const root=resolve(import.meta.dirname,'..');
const oldPixels=resolve(root,'packages/scenes/src/measurement-old-pixels.ts');
const oldTarot=resolve(root,'packages/scenes/src/measurement-old-tarot.ts');
let browser;
try {
await writeFile(oldPixels,execFileSync('git',['show','4e8e6c2:packages/scenes/src/tarot-pixels.ts'],{cwd:root}));
await writeFile(oldTarot,(await readFile(resolve(root,'packages/scenes/src/tarot.ts'),'utf8')).replace('./tarot-pixels','./measurement-old-pixels'));
const output=root+'/docs/validation/globe-lighting/';const tag=process.env.BLUR_OUTPUT_TAG || 'blur';const forceFallback=process.env.FORCE_GLOW_FALLBACK==='1';browser=await chromium.launch({args:['--use-angle=metal']});const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto((process.env.STORYBOOK_URL || 'http://localhost:6007')+'/art/manifest.json');
await page.evaluate(async({root,forceFallback})=>{
const prefix='/@fs'+root+'/';const {SceneRuntime}=await import(prefix+'packages/scene-runtime/src/index.ts');const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;inset:0;width:1280px;height:720px;opacity:1;background:black';document.body.append(canvas);const runtime=new SceneRuntime(canvas,()=>{});runtime.frozen=true;cancelAnimationFrame(runtime.frame);canvas.style.opacity='1';const renderer=runtime.renderer;renderer.setSize(1280,720,false);renderer.info.autoReset=false;const floatSupported=renderer.extensions.has('EXT_color_buffer_float');const originalHas=renderer.extensions.has.bind(renderer.extensions);if(forceFallback)renderer.extensions.has=name=>name==='EXT_color_buffer_float'?false:originalHas(name);const scenes={};
for(const [key,path] of [['before','measurement-old-tarot'],['after','tarot']]){scenes[key]=await(await import(prefix+'packages/scenes/src/'+path+'.ts')).createScene(runtime.leases,new AbortController().signal);scenes[key].setShadows?.(true);scenes[key].resize(1280,720);scenes[key].enter()}
const manifest=await fetch('/art/manifest.json').then(r=>r.json());window.__ab={runtime,renderer,scenes,canvas,manifest,floatSupported,forceFallback};
window.__ab.draw=(key)=>{renderer.info.reset();scenes[key].update(3,window.__ab.data,true);scenes[key].render(renderer)};
},{root,forceFallback});
const result={},imageDifferences={};
for(const fixture of ['selection','reading','detail']){
await page.evaluate(async fixture=>{const a=window.__ab;const cards=fixture==='selection'?[]:['major.00','major.01','major.02'].map((id,i)=>({slot:i+4,name:a.manifest.cards[id].name,revealed:true,reversed:i===1,face:a.manifest.cards[id].url}));a.data={tarot:{phase:fixture==='selection'?'selecting':'reading',revision:fixture==='selection'?1:fixture==='reading'?2:3,page:0,focus:8,index:0,attempt:0,spread:3,cards,readingFocus:fixture==='selection'?null:0,reviewShot:fixture,reviewProgress:1}};for(const key of ['before','after'])a.draw(key);await new Promise(r=>setTimeout(r,1500));for(let i=0;i<30;i++)for(const key of ['before','after'])a.draw(key)},fixture);
const captures={};
for(const key of ['before','after']){await page.evaluate(key=>window.__ab.draw(key),key);captures[key]=(await page.screenshot({path:output+tag+'-'+fixture+'-'+key+'.png'})).toString('base64');}
imageDifferences[fixture]=await page.evaluate(async captures=>{
 const pixels={};let width=0,height=0;
 for(const key of ['before','after']){const img=new Image();img.src='data:image/png;base64,'+captures[key];await img.decode();width=img.width;height=img.height;const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);pixels[key]=ctx.getImageData(0,0,width,height).data;}
 let sum=0,max=0,changed=0,over3=0,over16=0,minX=width,minY=height,maxX=-1,maxY=-1;
 for(let i=0;i<pixels.before.length;i+=4){let local=0;for(let c=0;c<3;c++){const d=Math.abs(pixels.before[i+c]-pixels.after[i+c]);sum+=d;local=Math.max(local,d)}max=Math.max(max,local);if(local>0)changed++;if(local>16)over16++;if(local>3){over3++;const x=(i/4)%width,y=Math.floor(i/4/width);minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y)}}
 return {meanAbsoluteChannelDifference:sum/(width*height*3),maxChannelDifference:max,pixelsChanged:changed,pixelsOver3:over3,pixelsOver16:over16,pixelsOver3Bounds:over3?[minX,minY,maxX,maxY]:null};
},captures);
result[fixture]=await page.evaluate(async()=>{const a=window.__ab,gl=a.renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');const rows={before:[],after:[]};for(let i=0;i<60;i++)for(const key of ['before','after']){const q=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,q);a.draw(key);gl.endQuery(ext.TIME_ELAPSED_EXT);gl.flush();let ok=false;for(let poll=0;poll<120;poll++){await new Promise(r=>requestAnimationFrame(r));ok=gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE);if(ok)break}if(ok&&!gl.getParameter(ext.GPU_DISJOINT_EXT))rows[key].push({iteration:i,ms:gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6,calls:a.renderer.info.render.calls,triangles:a.renderer.info.render.triangles});gl.deleteQuery(q)}return rows});console.log(fixture);
}
const afterDispose=await page.evaluate(()=>{const a=window.__ab;for(const s of Object.values(a.scenes))s.dispose();a.runtime.dispose();return{leases:a.runtime.leases.count,contextLost:a.renderer.getContext().isContextLost(),floatSupported:a.floatSupported,forceFallback:a.forceFallback}});await browser.close();const summary=Object.fromEntries(Object.entries(result).map(([fixture,variants])=>[fixture,Object.fromEntries(Object.entries(variants).map(([k,r])=>{const v=r.map(x=>x.ms).sort((a,b)=>a-b);return[k,{samples:v.length,median:v[30],p95:v[56],max:v.at(-1),calls:r[0].calls,triangles:r[0].triangles}]}))]));await writeFile(output+tag+'-ab.json',JSON.stringify({recordedAt:new Date().toISOString(),method:'Same production tarot factory, before differs only by importing exact old pixel-presentation source. One Metal renderer, paired60whole-frame GPUqueries pervariant perfixture,30pairedwarmupframes. Fixed1280x720DPR1 selection/reading/detail withsyntheticdisplay-onlycards. Screenshots from same actual renderframes.',result,summary,imageDifferences,afterDispose,errors},null,2)+'\n');console.log(JSON.stringify(summary,null,2));

} finally { await browser?.close();await Promise.all([unlink(oldPixels).catch(()=>{}),unlink(oldTarot).catch(()=>{})]); }
