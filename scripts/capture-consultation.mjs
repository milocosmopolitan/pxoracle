// Records the two consultation journeys with synthetic input and keeps key frames.
// Usage: node scripts/capture-consultation.mjs http://127.0.0.1:4173 docs/validation/consultation
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, renameSync } from "node:fs";
const base = process.argv[2] ?? "http://127.0.0.1:4173",
  out = process.argv[3] ?? "docs/validation/consultation";
mkdirSync(`${out}/videos`, { recursive: true });
const fixture = JSON.parse(readFileSync(new URL("../tests/fixtures/natal.json", import.meta.url), "utf8"))[0];
const savedCurrent = JSON.stringify({ schemaVersion: 1, input: fixture.input, chart: fixture.chart, plan: fixture.plan, versions: fixture.plan.versions, place: { source: "atlas", label: "Seoul, Seoul, South Korea", cityId: "1835848", country: "KR", atlasVersion: "synthetic" }, savedAt: "2026-10-11T00:00:00Z" });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ready = async (page) => {
  await page.getByRole("button", { name: "Natal Chart" }).waitFor();
  await page.waitForFunction(() => !document.querySelector("button[disabled] strong"), null, { timeout: 60000 });
  await page.locator(".scene-status").waitFor({ state: "hidden", timeout: 60000 });
  await page.locator(".door-entrance").waitFor({ state: "hidden", timeout: 30000 }).catch(() => {});
};
const shot = (page, name) => page.screenshot({ path: `${out}/${name}.png` });
const frames = async (page, name, delays) => {
  for (const [index, delay] of delays.entries()) {
    await page.waitForTimeout(delay);
    await shot(page, `${name}-${index}`);
  }
};
const report = [];
for (const [device, viewport] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
  // Journey 1: table → new chart → globe → country → city → confirm → table → date/time → review → crystal → table → resume.
  let context = await browser.newContext({ viewport, reducedMotion: "no-preference", recordVideo: { dir: `${out}/videos`, size: viewport } });
  let page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const requests = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto(`${base}/astrology/`);
  await ready(page);
  await page.waitForTimeout(1200);
  await shot(page, `${device}-01-consultation-hub`);
  await page.getByRole("button", { name: "Natal Chart" }).click();
  await page.waitForTimeout(600);
  await shot(page, `${device}-02-natal-greeting-no-save`);
  assert.equal(requests.filter((u) => /\/engines\//.test(u)).length, 0, "no engine before the service choice");
  await page.locator(".oracle-bubble").getByRole("button", { name: "Begin a new chart" }).click();
  await frames(page, `${device}-03-globe-approach`, [350, 500, 1200]);
  await page.getByLabel("Birth country").selectOption("KR");
  await frames(page, `${device}-04-country-korea`, [400, 1400]);
  await page.getByLabel("Birth city", { exact: true }).fill("Seoul");
  const beforeCity = await page.locator(".natal-stage").screenshot();
  await page.getByRole("button", { name: /Seoul.*Seoul.*South Korea/ }).click();
  await page.locator(".place-confirmation").waitFor();
  await page.waitForTimeout(700);
  const afterCity = await page.locator(".natal-stage").screenshot();
  await shot(page, `${device}-05-city-selected-camera-fixed`);
  await page.getByRole("button", { name: "Confirm birthplace" }).click();
  await frames(page, `${device}-06-return-to-table`, [350, 500, 1200]);
  assert.equal(await page.locator(".natal-layout").getAttribute("data-stage"), "details");
  assert.equal(requests.filter((u) => /\/engines\//.test(u)).length, 0, "no engine before explicit calculation");
  await page.getByLabel("Birth date", { exact: true }).fill("2000-01-01");
  await page.getByLabel("Local birth time").fill("12:00");
  await shot(page, `${device}-07-birth-details`);
  await page.getByRole("button", { name: "Review the details" }).click();
  await page.waitForTimeout(500);
  await shot(page, `${device}-08-review`);
  await page.getByRole("button", { name: "Calculate and enter the crystal" }).click();
  await page.getByRole("heading", { name: "Your celestial map" }).waitFor({ timeout: 60000 });
  await frames(page, `${device}-09-crystal-approach`, [300, 500, 1400]);
  await page.getByRole("heading", { name: "A first look at your map" }).waitFor({ timeout: 60000 });
  await shot(page, `${device}-10-crystal-interpretation`);
  const planets = await page.locator(".planets").innerText();
  await page.getByRole("button", { name: "Return to the table" }).first().click();
  await frames(page, `${device}-11-return-from-crystal`, [350, 500, 1400]);
  await page.getByRole("button", { name: "Resume the current chart" }).click();
  await page.getByRole("heading", { name: "A first look at your map" }).waitFor({ timeout: 60000 });
  await page.waitForTimeout(1800);
  await shot(page, `${device}-12-resumed-chart`);
  assert.equal(await page.locator(".planets").innerText(), planets);
  assert.equal(await page.evaluate(() => localStorage.getItem("pxoracle.natal-report.v1")), null);
  assert.deepEqual(errors, []);
  let video = await page.video().path();
  await context.close();
  renameSync(video, `${out}/videos/${device}-new-chart-journey.webm`);
  report.push({ device, journey: "new-chart", cityCameraIdentical: beforeCity.equals(afterCity), engineRequests: requests.filter((u) => /\/engines\//.test(u)).length, errors });

  // Journey 2: saved chart → open without the globe → return to the table.
  context = await browser.newContext({ viewport, reducedMotion: "no-preference", recordVideo: { dir: `${out}/videos`, size: viewport } });
  page = await context.newPage();
  const phases = [];
  await page.exposeFunction("recordPhase", (phase) => phases.push(phase));
  await page.goto(`${base}/astrology/`);
  await page.evaluate((value) => localStorage.setItem("pxoracle.natal-report.v1", value), savedCurrent);
  await page.reload();
  await ready(page);
  await page.evaluate(() => {
    const target = document.querySelector(".natal-layout");
    new MutationObserver(() => window.recordPhase(target.getAttribute("data-globe-phase"))).observe(target, { attributes: true, attributeFilter: ["data-globe-phase"] });
  });
  await page.waitForTimeout(1000);
  await shot(page, `${device}-20-consultation-hub-saved`);
  await page.getByRole("button", { name: "Natal Chart" }).click();
  await page.waitForTimeout(600);
  await shot(page, `${device}-21-greeting-saved-chart`);
  await page.locator(".oracle-bubble").getByRole("button", { name: "Open saved chart" }).click();
  await page.getByRole("heading", { name: "A first look at your map" }).waitFor({ timeout: 60000 });
  await frames(page, `${device}-22-saved-crystal`, [300, 1600]);
  await page.getByRole("button", { name: "Return to the table" }).first().click();
  await frames(page, `${device}-23-saved-return`, [400, 1600]);
  assert.equal(await page.evaluate(() => localStorage.getItem("pxoracle.natal-report.v1")), savedCurrent);
  video = await page.video().path();
  await context.close();
  renameSync(video, `${out}/videos/${device}-saved-chart-journey.webm`);
  report.push({ device, journey: "saved-chart", globePhasesSeen: [...new Set(phases)], storageUnchanged: true });
}
// Landing desk: full room and desk close-up at desktop and mobile widths.
for (const [device, viewport] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto(`${base}/`);
  await page.waitForFunction(() => document.querySelector(".scene-host")?.getAttribute("data-ready") === "true", null, { timeout: 60000 });
  await page.locator(".door-entrance").waitFor({ state: "hidden", timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/landing-after-${device}.png` });
  if (device === "desktop") await page.screenshot({ path: `${out}/landing-after-desk-closeup.png`, clip: { x: 60, y: 380, width: 760, height: 420 } });
  await context.close();
}
await browser.close();
console.log(JSON.stringify(report, null, 2));
