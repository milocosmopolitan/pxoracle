import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, renameSync } from "node:fs";
const base = process.argv[2] ?? "http://localhost:3018",
  out = process.argv[3] ?? "docs/validation/natal/evidence";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
for (const [name, viewport] of [
  ["desktop", { width: 1355, height: 900 }],
  ["mobile", { width: 390, height: 844 }],
]) {
  const context = await browser.newContext({
    viewport,
    reducedMotion: "no-preference",
    recordVideo: { dir: `${out}/videos`, size: viewport },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}/astrology/`);
  await page.getByLabel("Birth country").selectOption("KR");
  await page.getByLabel("Birth city", { exact: true }).fill("서울");
  await page.getByRole("button", { name: /Seoul.*Seoul.*South Korea/ }).click();
  await page.getByLabel("Birth date", { exact: true }).fill("2000-01-01");
  await page.getByLabel("Local birth time").fill("12:00");
  await page
    .locator(".scene-status")
    .waitFor({ state: "hidden", timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${out}/${name}-entry.png` });
  await page.getByRole("button", { name: "Enter the crystal" }).click();
  await page
    .getByRole("heading", { name: "Your celestial map", exact: true })
    .waitFor();
  await page.screenshot({ path: `${out}/${name}-approach-start.png` });
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${out}/${name}-approach-mid.png` });
  await page
    .getByRole("heading", { name: "A first look at your map" })
    .waitFor({ timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${out}/${name}-overview.png` });
  await page.getByRole("button", { name: /^Moon / }).click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/${name}-moon.png` });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Read full HTML report" }).click();
  await page.screenshot({ path: `${out}/${name}-report.png` });
  if (name === "desktop") {
    const html = await page
      .getByRole("article", { name: "Full natal report" })
      .evaluate((el) => {
        const copy = el.cloneNode(true);
        copy.querySelectorAll("details").forEach((d) => (d.open = true));
        return copy.outerHTML;
      });
    writeFileSync(
      `${out}/completed-report.html`,
      `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>PXOracle synthetic natal report</title><style>body{margin:40px auto;padding:0 24px;max-width:850px;background:#101b1b;color:#eee6d6;font:17px/1.7 Georgia,serif}h1,h2,h3,h4,summary{color:#d8bf8a}h3{margin-top:3em}details,section{margin-bottom:1.5em}summary{font-size:1.2em}small{display:block;font:12px/1.6 sans-serif}button{font:inherit;color:inherit;background:transparent;border:1px solid #75664c;padding:4px 10px}table{width:100%;text-align:left}th,td{padding:8px;border-bottom:1px solid #465050}footer{border-top:1px solid #75664c}p{max-width:70ch}dt{font-weight:bold}dd{margin-bottom:8px}</style><body><p>Static evidence snapshot. Synthetic Seoul input, 2000-01-01 12:00 Asia/Seoul. No real person's birth record. Open the app for crystal navigation.</p>${html}</body></html>`,
    );
  }
  const report = await page
    .getByRole("article", { name: "Full natal report" })
    .innerText();
  assert.match(report, /Every supported placement/);
  await page.getByRole("button", { name: "Save on this device" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Open saved chart" }).click();
  await page
    .getByRole("heading", { name: "A first look at your map" })
    .waitFor({ timeout: 30000 });
  assert.deepEqual(errors, []);
  const video = await page.video().path();
  await context.close();
  renameSync(video, `${out}/${name}-sequence.webm`);
  console.log(
    JSON.stringify({ name, errors, video: `${out}/${name}-sequence.webm` }),
  );
}
await browser.close();
