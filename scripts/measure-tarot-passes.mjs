/** Diagnostic GPU pass timing; does not alter production quality. */
import {chromium} from '@playwright/test';
import {resolve} from 'node:path';
import {writeFile} from 'node:fs/promises';
const root=resolve(import.meta.dirname,'..');
const browser=await chromium.launch({args:['--use-angle=metal']});const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));await page.goto((process.env.STORYBOOK_URL || 'http://localhost:6007')+'/art/manifest.json');
const result=await page.evaluate(async root=>{
const prefix='/@fs'+root+'/';const {SceneRuntime}=await import(prefix+'packages/scene-runtime/src/index.ts');const {createScene}=await import(prefix+'packages/scenes/src/tarot.ts');
const canvas=document.createElement('canvas');document.body.append(canvas);const errors=[];const runtime=new SceneRuntime(canvas,s=>{if(s.includes('could not'))errors.push(s)});runtime.frozen=true;cancelAnimationFrame(runtime.frame);runtime.data={tarot:{phase:'selecting',revision:1,page:0,focus:8,index:0,attempt:0,spread:3,cards:[],reviewShot:'selection',reviewProgress:1}};
await runtime.navigate(createScene);runtime.active.resize?.(1280,720);const renderer=runtime.renderer,gl=renderer.getContext();renderer.setSize(1280,720,false);renderer.info.autoReset=false;const ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');if(!ext)throw Error('GPU timer unavailable');
let lamp,candle;runtime.active.scene.traverse(o=>{if(o.name==='lamp-primary-warm-shadow')lamp=o;if(o.name==='candle-prop')candle=o});if(!lamp||!candle)throw Error('Production prop missing');
const draw=()=>{renderer.info.reset();runtime.active.update(3,runtime.data,true);runtime.active.render(renderer)};
for(let i=0;i<60;i++)draw();await new Promise(r=>requestAnimationFrame(r));
const original=renderer.render.bind(renderer);let recording=false,queries=[];
renderer.render=(scene,camera)=>{if(!recording)return original(scene,camera);const target=renderer.getRenderTarget();const query=gl.createQuery();const stage=target?['low','full','mask','glow','blur-horizontal','blur-vertical'][queries.length]:'composite';gl.beginQuery(ext.TIME_ELAPSED_EXT,query);original(scene,camera);gl.endQuery(ext.TIME_ELAPSED_EXT);queries.push({query,stage,target:target?[target.width,target.height]:null})};
const data={'full-rig':[],'no-shadow':[],'candle-hidden':[]};
for(let iteration=0;iteration<60;iteration++) {
for(const scenario of Object.keys(data)){
lamp.castShadow=scenario!=='no-shadow';candle.visible=scenario!=='candle-hidden';queries=[];recording=true;draw();recording=false;gl.flush();
let available=false;for(let poll=0;poll<120;poll++){await new Promise(r=>requestAnimationFrame(r));available=queries.every(q=>gl.getQueryParameter(q.query,gl.QUERY_RESULT_AVAILABLE));if(available)break}
const disjoint=gl.getParameter(ext.GPU_DISJOINT_EXT);const stages=queries.map(q=>({stage:q.stage,target:q.target,ms:available&&!disjoint?gl.getQueryParameter(q.query,gl.QUERY_RESULT)/1e6:null}));queries.forEach(q=>gl.deleteQuery(q.query));data[scenario].push({iteration,valid:available&&!disjoint,stages,totalMs:available&&!disjoint?stages.reduce((a,s)=>a+s.ms,0):null,...runtime.diagnostics()});
}}
renderer.render=original;const debug=gl.getExtension('WEBGL_debug_renderer_info');const device={renderer:gl.getParameter(debug.UNMASKED_RENDERER_WEBGL),viewport:[1280,720],dpr:1};runtime.dispose();await new Promise(r=>setTimeout(r,150));return {device,data,errors,afterDispose:{leases:runtime.leases.count,contextLost:gl.isContextLost()}};
},root);await browser.close();
const stats=values=>{values.sort((a,b)=>a-b);return {samples:values.length,median:values[Math.floor(values.length/2)],p95:values[Math.ceil(values.length*.95)-1],max:values.at(-1)}};
const summary=Object.fromEntries(Object.entries(result.data).map(([key,rows])=>[key,{total:stats(rows.filter(r=>r.valid).map(r=>r.totalMs)),stages:Object.fromEntries(['low','full','mask','glow','blur-horizontal','blur-vertical','composite'].map(stage=>[stage,stats(rows.filter(r=>r.valid).flatMap(r=>r.stages.filter(s=>s.stage===stage).map(s=>s.ms)))])),calls:rows[0].calls,triangles:rows[0].triangles}]));
await writeFile(resolve(root,process.env.MEASUREMENT_OUTPUT || 'docs/validation/globe-lighting/performance-diagnostic-current.json'),JSON.stringify({recordedAt:new Date().toISOString(),method:'Actual production tarot selection. Same Metal browser,60interleaved iterations of full-rig/no-shadow/candle-hidden. Separate non-nested GPUqueries per renderer.render stage; summed stage durations exclude JS/interstage overhead.60warmup frames beforefirstrecord. Shadow maps retained duringtemporaryofftoggle. No production quality changes.',...result,summary,pageErrors},null,2)+'\n');console.log(JSON.stringify(summary,null,2));
