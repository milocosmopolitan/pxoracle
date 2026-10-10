import {test,expect} from "@playwright/test";
test("isolated production stories are labeled, interactive and never load WASM",async({page})=>{
 const wasm:string[]=[];page.on("request",r=>{if(r.url().includes("/engines/"))wasm.push(r.url());});
 for(const story of ["landing","astrology-input","astrology-reading","tarot-input","tarot-reading","loading-state","retry-state","mobile-tarot"]){
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
   for(const n of [1,13,78])await page.getByRole("button",{name:`Choose slot ${n}`,exact:true}).click();
   for(const n of [1,2,3])await page.getByRole("button",{name:`Reveal card ${n}`,exact:true}).click();
   await expect(page.getByRole("heading",{name:"Let the images settle."})).toBeVisible();
  }
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:test.info().outputPath(`${story}.png`),fullPage:true});
 }
 expect(wasm).toEqual([]);
});
