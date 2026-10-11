import { test, expect } from "@playwright/test";
import { settleTarot } from "./tarot-support";
test.beforeEach(async({browser},info)=>{await info.attach("browser-version",{body:JSON.stringify({project:info.project.name,version:browser.version()}),contentType:"application/json"});});
test("static direct routes, feature-only WASM, tarot restore and history", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Some answers",
  );
  await page.waitForTimeout(1000);
  expect(requests.filter((x) => x.endsWith(".wasm"))).toEqual([]);
    await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:test.info().outputPath("landing.png"),fullPage:false,scale:"css"});
  await page
    .getByRole("link", { name: "Let the cards speak", exact: false })
    .click();
  await page.getByRole("button", { name: "Shuffle the deck" }).click();
  await settleTarot(page, page.getByRole("button", { name: "Choose slot 1", exact: true }));
  await page.getByRole("button", { name: "Choose slot 1", exact: true }).click();
  await settleTarot(page, page.getByRole("button", { name: "Next cards", exact: true }));
  await page.getByRole("button", { name: "Next cards", exact: true }).click();
  await page.getByRole("button", { name: "Choose slot 13", exact: true }).click();
  await settleTarot(page, page.getByRole("button", { name: "Next cards", exact: true }));
  for (let n = 0; n < 5; n++) {
    await page.getByRole("button", { name: "Next cards", exact: true }).click();
    await expect(page.getByText(`${n + 3} / 7`, { exact: true })).toBeVisible();
  }
  await page.getByRole("button", { name: "Choose slot 78", exact: true }).click();
  await settleTarot(page, page.getByRole("heading", { name: "Let the images settle." }));
  expect(requests.some((x) => x.includes("/tarot/engine.wasm"))).toBeTruthy();
  expect(
    requests.some((x) => x.includes("/astrology/engine.wasm")),
  ).toBeFalsy();
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:test.info().outputPath("tarot-reading.png"),fullPage:false,scale:"css"});
    await page.getByRole("button", { name: "Save reading", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Resume a saved reading" }).click();
  await settleTarot(page, page.getByRole("heading", { name: "Let the images settle." }));
  await page.getByRole("link", { name: "The room", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading',{level:1})).toContainText('Some answers');
  await page.goBack();
  await expect(page).toHaveURL(/\/tarot\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Make a little room",
  );
});
test("real astrology worker and explicit unknown time", async ({ page }) => {
  const wasm: string[] = [];
  page.on("request", (r) => {
    if (r.url().endsWith(".wasm")) wasm.push(r.url());
  });
  await page.goto("/astrology/");
  await page.getByLabel("Birth date", { exact: true }).fill("2000-01-01");
  await page.getByLabel("Local birth time").fill("12:00");
  await page.getByLabel("Birthplace time zone").fill("UTC");
  await page.getByLabel("Latitude", { exact: true }).fill("0");
  await page.getByLabel("Longitude", { exact: true }).fill("0");
  await page.getByRole("button", { name: "Enter the crystal" }).click();
  await expect(
    page.getByRole("heading", { name: "Your celestial map" }),
  ).toBeVisible({ timeout: 20000 });
  await expect(
    page.getByRole("button", { name: /sun.*Capricorn/i }),
  ).toBeVisible({ timeout: 20000 });
  expect(wasm.some((x) => x.includes("/astrology/"))).toBeTruthy();
  expect(wasm.some((x) => x.includes("/tarot/"))).toBeFalsy();
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:test.info().outputPath("astrology-chart.png"),fullPage:false,scale:"css"});
  await page.getByRole('button',{name:'Save on this device'}).click();
  await page.reload();
  const beforeRestore=wasm.length;
  await page.getByRole('button',{name:'Open saved chart'}).click();
  await expect(page.getByRole('button',{name:/sun.*Capricorn/i})).toBeVisible({ timeout: 20000 });
  expect(wasm.length).toBe(beforeRestore);
  await page.getByRole('button',{name:'Edit details'}).click();
  await page.getByLabel('Time accuracy').selectOption('unknown');
  await page.getByRole('button',{name:'Enter the crystal'}).click();
  await expect(page.getByText('Birth time is uncertain.',{exact:false})).toBeVisible({ timeout: 20000 });
  await expect(page.getByText('Ascendant ·',{exact:false})).toHaveCount(0);

});
test("failed engine initialization offers a working retry", async ({
  page,
}) => {
  let fail = true;
  await page.route("**/tarot/worker.mjs", (route) =>
    fail ? route.abort() : route.continue(),
  );
  await page.goto("/tarot/");
  await page.getByRole("button", { name: "Shuffle the deck" }).click();
  await expect(page.locator('.error[role="alert"]')).toContainText("The calculation engine could not load");
  await expect(page.getByRole("button", {name:"Shuffle the deck"})).toBeEnabled();
  fail = false;
  await page.getByRole("button", { name: "Shuffle the deck" }).click();
  await settleTarot(page, page.getByRole("button", { name: "Choose slot 1", exact: true }));
});
test("rapid route changes keep a single canvas and usable keyboard navigation", async ({
  page,
}) => {
  await page.goto("/");
  for (let n = 0; n < 3; n++) {
    await page.getByRole("link", { name: "Astrology", exact: true }).click();
    await page.getByRole("link", { name: "Tarot", exact: true }).click();
    await page.getByRole("link", { name: "The room", exact: true }).click();
  }
  await expect(page.locator("canvas")).toHaveCount(1);
  const tarotLink = page.getByRole("link", { name: "Tarot", exact: true });
  await tarotLink.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/tarot\/$/);
});

test('repeated navigation releases WebGL allocations and records a frame baseline',async({page,browserName,isMobile})=>{
 test.skip(browserName!=='chromium'||isMobile,'Allocation instrumentation baseline is desktop Chromium only');
 test.setTimeout(240000);
 await page.setViewportSize({width:640,height:480});
 await page.emulateMedia({reducedMotion:"no-preference"});
 await page.addInitScript(()=>{
  const live={textures:new Set<unknown>(),buffers:new Set<unknown>(),programs:new Set<unknown>()};
  for(const ctor of [WebGLRenderingContext,WebGL2RenderingContext]){
   for(const [kind,suffix] of [['textures','Texture'],['buffers','Buffer'],['programs','Program']] as const){
    const proto=ctor.prototype as any,create=proto['create'+suffix],remove=proto['delete'+suffix];
    proto['create'+suffix]=function(...args:unknown[]){const item=create.apply(this,args);if(item)live[kind].add(item);return item;};
    proto['delete'+suffix]=function(item:unknown){live[kind].delete(item);return remove.call(this,item);};
   }
  }
  (window as any).__pxResources=()=>Object.fromEntries(Object.entries(live).map(([k,v])=>[k,v.size]));
 });
 await page.goto('/');
 const samples:Record<string,number>[]=[];
 for(let i=0;i<7;i++){
  for(const name of ['Astrology','Tarot','The room']){
   await page.getByRole('link',{name,exact:true}).click();
   await expect(page.locator('.scene-status')).toHaveCount(0,{timeout:15000});
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  }
  samples.push(await page.evaluate(()=>(window as any).__pxResources()));
 }
 for(const key of ['textures','buffers','programs'])expect(samples.at(-1)![key]).toBeLessThanOrEqual(samples[1][key]+1);
 const frameIntervals=await page.evaluate(()=>new Promise<number[]>(resolve=>{const values:number[]=[];let last=performance.now();function frame(now:number){values.push(now-last);last=now;if(values.length===60)resolve(values);else requestAnimationFrame(frame);}requestAnimationFrame(frame);}));
 await test.info().attach('navigation-resource-baseline',{body:JSON.stringify({samples,frameIntervalsMs:frameIntervals,viewport:{width:640,height:480},scope:'CI software-rendered Chrome at 640x480, standard motion; not a physical-device FPS guarantee'},null,2),contentType:'application/json'});
});

test('failed scene art preserves controls and offers an accessible retry',async({page,browserName})=>{
 let fail=true;
 await page.route('**/art/room.webp',route=>fail?route.abort():route.continue());
 await page.goto('/astrology/');
 await expect(page.getByLabel('Birth date',{exact:true})).toBeVisible({ timeout: 20000 });
 await page.getByLabel('Birth date',{exact:true}).fill('2000-01-01');
 await expect(page.locator('.scene-status')).toContainText(/retry|cannot start WebGL/i,{timeout:15000});
 if(browserName==='firefox'&&(await page.locator('.scene-status').innerText()).includes('cannot start WebGL')){
  await expect(page.getByLabel('Birth date',{exact:true})).toHaveValue('2000-01-01');
  await test.info().attach('graphics-support',{body:'Hosted Firefox cannot initialize WebGL; HTML form fallback remains usable. Asset retry is covered by Chrome/WebKit/mobile emulation.',contentType:'text/plain'});
  return;
 }
 const retry=page.getByRole('button',{name:'Retry scene'});
 await expect(retry).toBeVisible({ timeout: 20000 });fail=false;
 await retry.focus();await page.keyboard.press('Enter');
 await expect(page.locator('.scene-status')).toHaveCount(0,{timeout:15000});
 await expect(page.getByLabel('Birth date',{exact:true})).toHaveValue('2000-01-01');
});
