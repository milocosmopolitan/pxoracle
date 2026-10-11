// Run with a Storybook dev server: GLOBE_STORYBOOK=http://localhost:6008 node tests/globe-geography-browser.mjs
import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1000,height:900}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`${process.env.GLOBE_STORYBOOK??'http://localhost:6008'}/iframe.html?id=room-production-globe--front&viewMode=story`);
 await page.getByText('Ready',{exact:false}).waitFor();
 const measurements=await page.evaluate(async(root)=>{
  const {SceneRuntime}=await import(`/@fs/${root}/packages/scene-runtime/src/index.ts`);
  const {globePreview}=await import(`/@fs/${root}/packages/scenes/src/globe/preview.ts`);
  const canvas=document.createElement('canvas');canvas.style.cssText='width:640px;height:640px';document.body.append(canvas);
  const runtime=new SceneRuntime(canvas,()=>{}),cycles=[];let blank;
  // renderer.info omits InstancedMesh instance buffers; count actual context allocations too.
  const gl=runtime.renderer.getContext(),buffers=new Set();
  const createBuffer=gl.createBuffer.bind(gl),deleteBuffer=gl.deleteBuffer.bind(gl);
  gl.createBuffer=()=>{const buffer=createBuffer();if(buffer)buffers.add(buffer);return buffer;};
  gl.deleteBuffer=(buffer)=>{buffers.delete(buffer);return deleteBuffer(buffer);};
  const diagnostics=()=>({...runtime.diagnostics(),rawBuffers:buffers.size});
  const wait=()=>new Promise(resolve=>setTimeout(resolve,100));
  for(let cycle=0;cycle<8;cycle++){
   const start=performance.now();await runtime.navigate(async(leases,signal)=>{const instance=await globePreview('front')(leases,signal);blank={scene:instance.scene.clone(false),camera:instance.camera,enter(){},exit(){},update(){},dispose(){this.scene.clear();}};return instance;});
   await wait();cycles.push({cycle,prepareAndFirstRenderMs:performance.now()-start,...diagnostics()});
  }
  await Promise.all(Array.from({length:4},()=>runtime.navigate(globePreview('terrain'))));await wait();const rapid=diagnostics();
  await runtime.navigate(async()=>blank);await wait();const empty=diagnostics();runtime.dispose();canvas.remove();return {cycles,rapid,empty,userAgent:navigator.userAgent};
 },process.cwd());
 for(const cycle of measurements.cycles){assert.equal(cycle.textures,4);assert.equal(cycle.geometries,measurements.cycles[0].geometries);assert.equal(cycle.gpuTextures,measurements.cycles[0].gpuTextures);assert.equal(cycle.rawBuffers,measurements.cycles[0].rawBuffers);}
 assert(measurements.rapid.geometries>0&&measurements.rapid.geometries<=measurements.cycles[0].geometries);assert.equal(measurements.empty.rawBuffers,0);assert.equal(measurements.empty.textures,0);assert.equal(measurements.empty.geometries,0);assert.equal(measurements.empty.gpuTextures,1);assert.deepEqual(errors,[]);
 fs.writeFileSync('docs/validation/globe-lighting/globe-resources.json',JSON.stringify({...measurements,errors,scope:'Headless Chromium, isolated production globe. Preview has no shadow-casting lights. Counts are live renderer allocation counts, not hardware VRAM bytes or physical mobile qualification. Empty scene retains one renderer-owned Three r186 DFG LUT after physical-material warmup (WebGLRenderer getDFGLUT); all globe textures, geometries, programs and leases return to zero.'},null,2)+'\n');
 console.log(JSON.stringify(measurements,null,2));
}finally{await browser.close();}
