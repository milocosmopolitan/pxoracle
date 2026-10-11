import {readFileSync,writeFileSync} from "node:fs";
import {test,expect} from "@playwright/test";
test("isolated production stories are labeled, interactive and never load WASM",async({page})=>{
 const wasm:string[]=[];page.on("request",r=>{if(r.url().includes("/engines/"))wasm.push(r.url());});
 for(const story of ["landing","astrology-input","astrology-reading","tarot-input","tarot-reading","loading-state","retry-state","mobile-tarot"]){
  await page.setViewportSize(story==="mobile-tarot"?{width:390,height:844}:{width:1280,height:720});
  await page.goto(`/iframe.html?id=pxoracle-scenes--${story}&viewMode=story`);
  await expect(page.getByText("STORYBOOK · Deterministic mock data · No WASM calculations")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1);
  if(story==="retry-state"){
   await page.getByRole("button",{name:"Try again"}).click();
   await expect(page.getByRole("heading",{name:"Take your time."})).toBeVisible();
  }
  if(story==="astrology-reading"){
   await page.getByRole("button",{name:/^moon/i}).click();
   await expect(page.locator(".body-reading .eyebrow")).toContainText("moon");
  }
  if(story==="tarot-input"){
   await page.getByRole("button",{name:"Shuffle the deck"}).click();
   for(const n of [1,2,3])await page.getByRole("button",{name:`Choose slot ${n}`,exact:true}).click();
   await expect(page.getByRole("heading",{name:"Let the images settle."})).toBeVisible();
  }
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:test.info().outputPath(`${story}.png`),fullPage:false,scale:"css"});
 }
 expect(wasm).toEqual([]);
});

test("Storybook dev HMR releases old scene listeners",async({page})=>{
 await page.addInitScript(()=>{
  let active=0;const add=EventTarget.prototype.addEventListener,remove=EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener=function(type,...args){if(this instanceof HTMLCanvasElement&&type==='webglcontextlost')active++;return (add as any).call(this,type,...args);};
  EventTarget.prototype.removeEventListener=function(type,...args){if(this instanceof HTMLCanvasElement&&type==='webglcontextlost')active--;return (remove as any).call(this,type,...args);};
  (window as any).__pxSceneListeners=()=>active;
 });
 await page.goto('http://127.0.0.1:6107/iframe.html?id=pxoracle-scenes--landing&viewMode=story');
 await expect(page.getByRole('heading',{name:'Take your time.'})).toBeVisible();
 await expect(page.locator('.scene-status')).toHaveCount(0,{timeout:20000});
 const path='apps/web/src/stories/Oracle.stories.tsx',original=readFileSync(path,'utf8');
 const baseline=await page.evaluate(()=>(window as any).__pxSceneListeners());
 try{
  for(let i=0;i<3;i++){
   writeFileSync(path,original.replace('Take your time.',`HMR verified ${i}.`));
   await expect(page.getByRole('heading',{name:`HMR verified ${i}.`})).toBeVisible({timeout:20000});
   await expect(page.locator('.scene-status')).toHaveCount(0,{timeout:20000});
   await expect(page.locator('canvas')).toHaveCount(1);
   expect(await page.evaluate(()=>(window as any).__pxSceneListeners())).toBeLessThanOrEqual(baseline);
  }
 }finally{writeFileSync(path,original);}
});
