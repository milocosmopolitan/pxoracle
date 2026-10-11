/** Real Chromium + production SceneRuntime/factories. Run against local Storybook. */
import { chromium } from '@playwright/test';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { resolve, relative } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const base = process.env.STORYBOOK_URL || 'http://localhost:6007';
const browserOptions = {headless:process.env.CHROMIUM_HEADED !== '1', args:JSON.parse(process.env.CHROMIUM_ARGS || '[]')};
const outputPath = process.env.MEASUREMENT_OUTPUT || 'docs/validation/globe-lighting/performance.json';
const measureGpuTimers = process.env.MEASURE_GPU_TIMERS === '1';
const browser = await chromium.launch(browserOptions);
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await page.addInitScript(() => {
  window.__gpuCounts = new WeakMap();
  for (const kind of ['Buffer','Texture','Framebuffer','Renderbuffer','Program','Shader']) {
    for (const [prefix,delta] of [['create',1],['delete',-1]]) {
      const key = prefix + kind, original = WebGL2RenderingContext.prototype[key];
      WebGL2RenderingContext.prototype[key] = function(...args) {
        const result = original.apply(this,args);
        if ((delta > 0 && result) || (delta < 0 && args[0])) {
          let counts = window.__gpuCounts.get(this);
          if(!counts){counts={};window.__gpuCounts.set(this,counts);}
          counts[kind] ??= { created: 0, deleted: 0, live: 0 };
          counts[kind][delta > 0 ? 'created' : 'deleted']++;
          counts[kind].live += delta;
        }
        return result;
      };
    }
  }
});
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if(message.text().startsWith('MEASURE ')) console.log(message.text()); });
// A static same-origin document avoids Storybook HMR destroying the measurement context.
await page.goto(base + '/art/manifest.json');
const baselineAvailable = await stat(resolve(root,'packages/scenes/src/measurement-baseline.ts')).then(()=>true,()=>false);
const measured = await page.evaluate(async ({root,baselineAvailable,measureGpuTimers}) => {
  const source = '/@fs' + root + '/';
  const { SceneRuntime } = await import(source + 'packages/scene-runtime/src/index.ts');
  const factories = {};
  for(const route of ['landing','astrology','tarot']) factories[route] = (await import(source + 'packages/scenes/src/' + route + '.ts')).createScene;
  if(baselineAvailable) factories.baseline = (await import(source + 'packages/scenes/src/measurement-baseline.ts')).createScene;
  const canvas = document.createElement('canvas');
  canvas.style.cssText='position:fixed;inset:0;width:1280px;height:720px;z-index:999';
  document.body.append(canvas);
  const statuses = [];
  const runtime = new SceneRuntime(canvas, s => { if(s.includes('could not')) statuses.push(s); });
  runtime.frozen = true;
  cancelAnimationFrame(runtime.frame);
  const renderer = runtime.renderer, gl = renderer.getContext();
  renderer.info.autoReset = false;
  renderer.setSize(1280,720,false);
  const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));
  const globe = (phase, country=null, revision=1) => ({globe:{phase,country,region:null,revision,viewport:{left:0,top:0,width:1,height:1},reviewProgress:1}});
  const tarot = {tarot:{phase:'selecting',revision:1,page:0,focus:8,index:0,attempt:0,spread:3,cards:[],reviewShot:'selection',reviewProgress:1}};
  function render() {
    renderer.info.reset();
    runtime.active.update(3,runtime.data,true);
    if(runtime.active.render) runtime.active.render(renderer);
    else renderer.render(runtime.active.scene,runtime.active.camera);
  }
  async function navigate(route,data={}) {
    const t=performance.now();runtime.data=data;await runtime.navigate(factories[route]);
    if(!runtime.active) throw new Error('Scene preparation failed: '+route);
    setShadows(true);
    runtime.active.resize?.(1280,720);render();await delay(70);render();
    return performance.now()-t;
  }
  function snapshot(label) {
    render();
    const counters = structuredClone(window.__gpuCounts.get(gl));
    let casters=0,lights=0;
    runtime.active.scene.traverse(o=>{if(o.isLight){lights++;if(o.castShadow)casters++;}});
    return {label,...runtime.diagnostics(),shadowLights:casters,lights,gpu:counters};
  }
  function setShadows(on) {
    runtime.active.scene.traverse(o=>{
      if(o.isLight && o.name==='lamp-primary-warm-shadow') {
        o.castShadow=on;
        if(!on){o.shadow.dispose();o.shadow.map=null;o.shadow.mapPass=null;}
      }
    });
  }
  async function gpuTiming() {
    const extension = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    if(!measureGpuTimers || !extension) return {requested:measureGpuTimers,available:!!extension,samples:0};
    const times=[];
    for(let i=0;i<12;i++) {
      const query=gl.createQuery();
      gl.beginQuery(extension.TIME_ELAPSED_EXT,query);render();gl.endQuery(extension.TIME_ELAPSED_EXT);gl.flush();
      let available=false;
      for(let poll=0;poll<120;poll++) {
        await new Promise(resolve=>requestAnimationFrame(resolve));
        available=gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE);
        if(available)break;
      }
      const disjoint=gl.getParameter(extension.GPU_DISJOINT_EXT);
      if(available&&!disjoint)times.push(gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6);
      gl.deleteQuery(query);
    }
    times.sort((a,b)=>a-b);
    return {requested:true,available:true,samples:times.length,median:times[Math.floor(times.length/2)]??null,p95:times[Math.floor(times.length*.95)]??null,max:times.at(-1)??null};
  }
  const views=[];
  const cases = [['room','landing',{}],['overview','astrology',globe('overview')],['country-SG','astrology',globe('country','SG')],['tarot','tarot',tarot]];
  if(baselineAvailable) cases.push(['tarot-baseline-shared-runtime','baseline',tarot]);
  for(const [label,route,data] of cases) {
    const preparationMs=await navigate(route,data);
    console.log('MEASURE '+label);
    // Qualification compares the authored full rig with its fallback, independent of device defaults.
    setShadows(true);
    const withShadows=snapshot(label);
    const times=[];
    for(let i=0;i<60;i++){const t=performance.now();render();times.push(performance.now()-t);}
    times.sort((a,b)=>a-b);
    const gpuExecutionMs=await gpuTiming();
    setShadows(false);const withoutShadows=snapshot(label+'-no-shadow');
    setShadows(true);render();
    views.push({label,preparationMs,withShadows,withoutShadows,gpuExecutionMs,cpuSubmissionMs:{median:times[30],p95:times[57],max:times[59],samples:60}});
  }
  const cycles=[];
  for(let cycle=0;cycle<7;cycle++) {
    await navigate('astrology',globe('overview',null,cycle+2));
    runtime.data=globe('country','FJ',cycle+20);render();
    await navigate('tarot',tarot);
    await navigate('landing');
    cycles.push(snapshot('return-room-'+(cycle+1)));console.log('MEASURE cycle '+(cycle+1));
  }
  const debug=gl.getExtension('WEBGL_debug_renderer_info');
  const device={userAgent:navigator.userAgent,dpr:devicePixelRatio,viewport:[1280,720],vendor:debug?gl.getParameter(debug.UNMASKED_VENDOR_WEBGL):null,renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):null,webglVersion:gl.getParameter(gl.VERSION),timerQueryAvailable:!!gl.getExtension('EXT_disjoint_timer_query_webgl2')};
  const intervals=[];let previous=await new Promise(resolve=>requestAnimationFrame(resolve));
  for(let i=0;i<30;i++){const next=await new Promise(resolve=>requestAnimationFrame(resolve));intervals.push(next-previous);previous=next;render();}
  intervals.sort((a,b)=>a-b);
  runtime.dispose();await delay(150);
  return {device,views,cycles,animationFrameIntervalsMs:{median:intervals[15],p95:intervals[28],samples:30},afterDispose:{contextLost:gl.isContextLost(),leases:runtime.leases.count,gpu:structuredClone(window.__gpuCounts.get(gl))},statuses};
}, {root,baselineAvailable,measureGpuTimers}).catch(async error => { await browser.close(); throw error; });
await browser.close();
const assets=[];
for(const entry of await readdir(resolve(root,'apps/web/public/globe'))){const path=resolve(root,'apps/web/public/globe',entry);if(!(await stat(path)).isFile())continue;const bytes=await readFile(path);assets.push({path:relative(root,path),bytes:bytes.length,gzipBytes:gzipSync(bytes,{level:9}).length});}
const result={recordedAt:new Date().toISOString(),method:'Actual headless Chromium, production SceneRuntime + landing/astrology/tarot factories imported through local Storybook Vite; explicitly enables authored lamp shadows for full-rig comparison, no substitute scene.',limitations:[baselineAvailable ? 'Approximate tarot source baseline from2482c84 uses current shared composition/runtime, not an isolated old full application.' : 'No before-change baseline measured.','Headless local browser is not physical mobile qualification.','CPU submission durations are wall clock around production update/render, not GPU execution time; software-driver backpressure may block submission.',
'Preparation duration includes navigation, first render and an intentional 70 ms stabilization wait.','GPU resource counts are WebGL create/delete and renderer.info counts, not driver memory bytes.',measureGpuTimers ? 'GPU durations include all production scene passes; timer availability and accepted sample counts are recorded per view.' : 'No GPU timer duration collected.'],browserOptions,...measured,assets,assetTotals:assets.reduce((sum,a)=>({bytes:sum.bytes+a.bytes,gzipBytes:sum.gzipBytes+a.gzipBytes}),{bytes:0,gzipBytes:0}),errors};
result.assetTiers = Object.fromEntries(Object.entries({room:assets.filter(a=>/-room|brass-roughness|walnut/.test(a.path)),country:assets.filter(a=>!a.path.includes('-room'))}).map(([tier,files])=>[tier,files.reduce((sum,a)=>({bytes:sum.bytes+a.bytes,gzipBytes:sum.gzipBytes+a.gzipBytes}),{bytes:0,gzipBytes:0})]));
await writeFile(resolve(root,outputPath),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({views:result.views.map(v=>({label:v.label,calls:v.withShadows.calls,triangles:v.withShadows.triangles,geometries:v.withShadows.geometries,textures:v.withShadows.gpuTextures,shadowDelta:v.withShadows.calls-v.withoutShadows.calls})),cycles:result.cycles.map(c=>({geometries:c.geometries,textures:c.gpuTextures,live:c.gpu})),afterDispose:result.afterDispose,errors},null,2));
