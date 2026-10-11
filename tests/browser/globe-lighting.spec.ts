import { test, expect, type Page } from "@playwright/test";
import { graphicsAvailable } from "./tarot-support";

test.use({ reducedMotion: "reduce" });

async function room(page: Page, requireGraphics = true) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/astrology/");
  await expect(page.getByLabel("Birth country")).toBeEnabled();
  if (!(await graphicsAvailable(page))) {
    test.skip(requireGraphics, "WebGL unavailable in this browser environment; HTML form is usable, visual qualification remains unsupported.");
    return;
  }
  await expect(page.locator(".scene-status")).toHaveCount(0);
  await page.waitForFunction(() => [...document.querySelectorAll("canvas")].some(canvas => canvas.style.opacity === "1"));
}
async function stableStage(page: Page) {
  const stage = page.locator(".natal-stage");
  await stage.scrollIntoViewIfNeeded();
  let previous = await stage.screenshot({ animations: "disabled" });
  const first = previous;
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(250);
    const current = await stage.screenshot({ animations: "disabled" });
    if (current.equals(previous)) return current;
    previous = current;
  }
  await test.info().attach("unsettled-first", { body: first, contentType: "image/png" });
  await test.info().attach("unsettled-last", { body: previous, contentType: "image/png" });
  throw new Error("Reduced-motion country view did not settle; reduce=" + await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches));
}

test("region/country/city keeps the country frame and only loads selected atlas shards", async ({ page }) => {
  const requests: string[] = [], errors: string[] = [];
  page.on("request", r => requests.push(r.url()));
  page.on("pageerror", e => errors.push(e.message));
  await room(page);
  expect(requests.filter(url => /\/content\/atlas\/[A-Z]{2}\./.test(url))).toEqual([]);
  await page.getByRole("button", { name: "Explore the globe", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.getByLabel("Browsing region").selectOption("asia");
  await page.getByLabel("Birth country").selectOption("KR");
  await page.getByLabel("Birth city", { exact: true }).fill("Seoul");
  const city = page.getByRole("button", { name: /Seoul.*Seoul.*South Korea/ });
  await expect(city).toBeVisible();
  const before = await stableStage(page);
  await city.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".place-confirmation")).toContainText("Asia/Seoul");
  const after = await stableStage(page);
  await test.info().attach("country-before-city", { body: before, contentType: "image/png" });
  await test.info().attach("country-after-city", { body: after, contentType: "image/png" });
  expect(after.equals(before), "City choice must not move the country view").toBe(true);
  expect(requests.filter(url => /\/content\/atlas\/[A-Z]{2}\./.test(url)).every(url => /\/KR\./.test(url))).toBe(true);
  expect(requests.some(url => /\/engines\/.*\.wasm/.test(url))).toBe(false);
  expect(requests.some(url => /Seoul|Asia%2FSeoul|37\.56|126\.97/.test(url))).toBe(false);
  expect(new URL(page.url()).search).toBe("");
  await page.getByRole("button", { name: "Back one view" }).click();
  await expect(page.getByLabel("Birth country")).toHaveValue("");
  await expect(page.getByLabel("Browsing region")).toHaveValue("asia");
  await page.getByRole("button", { name: "Room view" }).click();
  await expect(page.getByRole("button", { name: "Back one view" })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("country changes invalidate the city and timezone while manual entry remains local", async ({ page }) => {
  const outgoing: string[] = [];
  page.on("request", r => outgoing.push(r.url() + (r.postData() ?? "")));
  await room(page, false);
  await page.getByLabel("Birth country").selectOption("KR");
  await page.getByLabel("Birth city", { exact: true }).fill("Seoul");
  await page.getByRole("button", { name: /Seoul.*Seoul.*South Korea/ }).click();
  await page.getByLabel("Birth country").selectOption("SG");
  await expect(page.locator(".place-confirmation")).toHaveCount(0);
  await expect(page.getByLabel("Birth city", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "Enter or adjust coordinates" }).click();
  await expect(page.getByLabel("Birthplace time zone")).toHaveValue("");
  await expect(page.getByLabel("Latitude", { exact: true })).toHaveValue("");
  await page.getByLabel("Birthplace time zone").fill("Pacific/Fiji");
  await page.getByLabel("Latitude", { exact: true }).fill("-17.7134");
  await page.getByLabel("Longitude", { exact: true }).fill("178.0650");
  await page.getByLabel("Birthplace label (optional)").fill("LOCAL_ONLY_SENTINEL_75193");
  expect(outgoing.some(url => /LOCAL_ONLY_SENTINEL_75193|Pacific.Fiji|-17\.7134|178\.0650/.test(url))).toBe(false);
  expect(new URL(page.url()).search).toBe("");
});

test("large and tiny countries and dateline islands retain finite visible frames", async ({ page }) => {
  await room(page);
  await page.getByRole("button", { name: "Explore the globe", exact: true }).click();
  const captures: Buffer[] = [];
  for (const code of ["RU", "SG", "FJ", "IS"]) {
    await page.getByLabel("Browsing region").selectOption("");
    await page.getByLabel("Birth country").selectOption(code);
    await expect(page.getByLabel("Birth city", { exact: true })).toBeVisible();
    const image = await stableStage(page);
    expect(image.length).toBeGreaterThan(10000);
    captures.push(image);
    await page.locator(".natal-stage").screenshot({ path: test.info().outputPath(`country-${code}.png`) });
  }
  expect(captures[0].equals(captures[1])).toBe(false);
  expect(captures[1].equals(captures[2])).toBe(false);
});

test("asset retry restores the scene and city search survives WebGL unavailability", async ({ page }) => {
  // A hosted browser without WebGL cannot acquire scene textures, but must still pass the HTML fallback.
  const available = await graphicsAvailable(page);
  if (available) {
    let blocked = true;
    await page.route("**/art/candle.webp", route => blocked ? route.abort() : route.continue());
    await page.goto("/astrology/");
    await expect(page.getByRole("button", { name: "Retry scene" })).toBeVisible();
    await expect(page.getByLabel("Birth country")).toBeEnabled();
    blocked = false;
    await page.getByRole("button", { name: "Retry scene" }).click();
    await expect(page.locator(".scene-status")).toHaveCount(0);
  } else {
    test.info().annotations.push({ type: "unsupported", description: "Scene asset retry requires WebGL; HTML fallback is exercised below." });
  }
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) {
      if (type.startsWith("webgl")) return null;
      return Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
  await page.goto("/astrology/");
  await expect(page.getByText("Your browser cannot start WebGL. All reading controls remain available.")).toBeVisible();
  await page.getByLabel("Birth country").selectOption("SG");
  await page.getByLabel("Birth city", { exact: true }).fill("Singapore");
  await expect(page.getByRole("button", { name: /Singapore.*Asia\/Singapore/ }).first()).toBeVisible();
});

test("keyboard rotation and zoom controls visibly adjust a country view", async ({ page }) => {
  await room(page);
  await page.getByLabel("Birth country").selectOption("SG");
  const before = await stableStage(page);
  await page.getByRole("button", { name: "Turn globe east" }).focus();
  await page.keyboard.press("Enter");
  const turned = await stableStage(page);
  expect(turned.equals(before)).toBe(false);
  await page.getByRole("button", { name: "Zoom globe out" }).focus();
  await page.keyboard.press("Enter");
  const zoomed = await stableStage(page);
  expect(zoomed.equals(turned)).toBe(false);
  await expect(page.getByLabel("Birth country")).toHaveValue("SG");
  await page.getByRole("button", { name: "Turn globe west" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Zoom globe in" })).toBeEnabled();
});

test("actual globe raycasts select the same region, country and atlas shard as the HTML flow", async ({ page, isMobile }) => {
  const shards: string[] = [];
  page.on("request", request => {
    const match = request.url().match(/\/content\/atlas\/([A-Z]{2})\./);
    if (match) shards.push(match[1]);
  });
  await room(page);
  await page.getByRole("button", { name: "Explore the globe", exact: true }).click();
  await stableStage(page);
  const pickCenter = async () => {
    const bounds = await page.locator(".natal-stage").boundingBox();
    expect(bounds).toBeTruthy();
    const x = bounds!.x + bounds!.width / 2, y = bounds!.y + bounds!.height / 2;
    if (isMobile) await page.touchscreen.tap(x, y);
    else await page.mouse.click(x, y);
  };
  await pickCenter();
  await expect(page.getByLabel("Browsing region")).toHaveValue("africa");
  await expect(page.getByLabel("Birth country")).toHaveValue("");
  expect(shards).toEqual([]);
  await stableStage(page);
  await pickCenter();
  await expect(page.getByLabel("Birth country")).toHaveValue("CD");
  await expect(page.getByLabel("Birth city", { exact: true })).toBeVisible();
  await expect.poll(() => shards).toEqual(["CD"]);
  expect(new URL(page.url()).search).toBe("");
});
