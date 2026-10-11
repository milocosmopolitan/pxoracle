import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
const base = process.env.READING_URL ?? "http://127.0.0.1:4180";
const output = "docs/validation/reading";
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = {
  browser: browser.version(),
  desktop: "1355x900",
  mobile: "390x844 Chromium emulation",
  checks: [],
  errors: [],
};
async function setup(viewport) {
  const context = await browser.newContext({
    viewport,
    reducedMotion: "reduce",
  });
  await context.addInitScript(() => {
    window.__readingMessages = [];
    const Original = window.Worker;
    window.Worker = class extends Original {
      postMessage(message, ...args) {
        window.__readingMessages.push(message);
        return super.postMessage(message, ...args);
      }
    };
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => report.errors.push(e.message));
  return { context, page };
}
async function draw(page) {
  await page.getByRole("button", { name: "Shuffle the deck" }).click();
  for (let n = 1; n <= 3; n++) {
    const choose = page.getByRole("button", {
      name: `Choose slot ${n}`,
      exact: true,
    });
    await choose.waitFor({ state: "visible", timeout: 30000 });
    await choose.focus();
    await page.keyboard.press("Enter");
    await page
      .getByRole("heading", { name: `${n} of 3 cards selected`, exact: true })
      .waitFor({ timeout: 15000 });
  }
  await page
    .locator('.tarot-layout[data-phase="reading"]')
    .waitFor({ timeout: 30000 });
}
try {
  const { page, context } = await setup({ width: 1355, height: 900 });
  const requests = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto(base + "/tarot/");
  await page
    .getByLabel("A private note, if you wish")
    .fill("PRIVATE_BROWSER_TEST_SENTINEL");
  await page.getByLabel("Topic", { exact: true }).selectOption("creativity");
  await page.getByLabel("Intention").selectOption("action");
  assert.equal(
    requests.some((u) => u.includes("/engines/")),
    false,
  );
  assert.equal(
    requests.some((u) => u.includes("/content/reading/")),
    false,
  );
  let fail = true;
  await context.route("**/content/reading/rules.1.json", (route) =>
    fail
      ? route.fulfill({ status: 503, body: "unavailable" })
      : route.continue(),
  );
  await draw(page);
  await page.getByRole("button", { name: "Retry reflection" }).waitFor();
  assert.equal(await page.getByLabel("Topic", { exact: true }).count(), 0);
  await page.getByRole("button", { name: "Save reading", exact: true }).click();
  const failedSave = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("pxoracle.tarot.v2")),
  );
  fail = false;
  await page.getByRole("button", { name: "Retry reflection" }).click();
  await page
    .getByRole("heading", { name: "The whole reading" })
    .waitFor({ timeout: 20000 });
  const result = await page.locator(".structured-reading").innerText();
  assert.ok(result.includes("One small action"));
  assert.ok(result.includes("creativity"));
  const names = page.locator(".structured-reading h4 button");
  await names.nth(1).focus();
  await page.keyboard.press("Enter");
  assert.equal(await names.nth(1).getAttribute("aria-pressed"), "true");
  await page.getByRole("button", { name: "Save reading", exact: true }).click();
  const saved = await page.evaluate(() =>
    localStorage.getItem("pxoracle.tarot.v2"),
  );
  assert.ok(!saved.includes("PRIVATE_BROWSER_TEST_SENTINEL"));
  assert.deepEqual(JSON.parse(saved).draw, failedSave.draw);
  const messages = await page.evaluate(() => window.__readingMessages);
  assert.ok(
    !JSON.stringify(messages).includes("PRIVATE_BROWSER_TEST_SENTINEL"),
  );
  const interpretations = messages.filter(
    (m) => m.payload?.op === "readingInterpret",
  );
  assert.ok(interpretations.length >= 2);
  assert.ok(
    interpretations.every(
      (m) =>
        !("deck" in m.payload.input) &&
        !("note" in m.payload.input) &&
        m.payload.input.cards.length === 3,
    ),
  );
  assert.deepEqual(
    interpretations[0].payload.input.cards,
    interpretations.at(-1).payload.input.cards,
  );
  assert.ok(
    !requests.some(
      (u) =>
        u.includes("/engines/astrology/") ||
        u.includes("PRIVATE_BROWSER_TEST_SENTINEL"),
    ),
  );
  await page
    .locator(".structured-reading")
    .screenshot({ path: output + "/desktop-reading.png" });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: output + "/desktop-scene.png" });
  report.checks.push(
    "Desktop real WASM draw/reveal, frozen perspective, keyboard card focus, pack failure/retry keeps same cards, explicit save, request/note privacy, independent lazy engines",
  );
  await page.reload();
  await page.getByRole("button", { name: "Resume a saved reading" }).click();
  await page.getByRole("heading", { name: "The whole reading" }).waitFor();
  assert.equal(await page.locator(".structured-reading").innerText(), result);
  report.checks.push("Pinned restore reproduces exactly the same reading");
  let failWorker = true;
  await context.route("**/engines/tarot/worker.mjs", (route) =>
    failWorker ? route.abort() : route.continue(),
  );
  await page.reload();
  await page.getByRole("button", { name: "Resume a saved reading" }).click();
  await page.getByRole("button", { name: "Try again", exact: true }).waitFor();
  failWorker = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page.getByRole("heading", { name: "The whole reading" }).waitFor();
  assert.equal(await page.locator(".structured-reading").innerText(), result);
  assert.ok(
    (await page.evaluate(() => window.__readingMessages)).every(
      (m) => m.payload?.op !== "create",
    ),
  );
  await context.unroute("**/engines/tarot/worker.mjs");
  report.checks.push(
    "Failed saved-draw engine initialization retries restore, never creates a replacement deck",
  );

  await page.evaluate((raw) => {
    const saved = JSON.parse(raw);
    localStorage.removeItem("pxoracle.tarot.v2");
    localStorage.setItem(
      "pxoracle.tarot.v1",
      JSON.stringify({ schemaVersion: 1, value: saved.draw }),
    );
  }, saved);
  await page.reload();
  await page.getByRole("button", { name: "Resume a saved reading" }).click();
  await page.getByRole("button", { name: "Use this perspective" }).waitFor();
  assert.equal(
    await page.getByRole("heading", { name: "The whole reading" }).count(),
    0,
  );
  await page.getByLabel("Topic", { exact: true }).selectOption("work");
  await page.getByRole("button", { name: "Use this perspective" }).click();
  await page.getByRole("heading", { name: "The whole reading" }).waitFor();
  report.checks.push("Legacy v1 keeps cards and requires explicit perspective");
  await page.evaluate((raw) => {
    const value = JSON.parse(raw);
    value.readingVersions.content = "reading.en.999";
    localStorage.setItem("pxoracle.tarot.v2", JSON.stringify(value));
  }, saved);
  await page.reload();
  await page.getByRole("button", { name: "Resume a saved reading" }).click();
  await page
    .getByRole("button", {
      name: "Reinterpret these cards with current content",
    })
    .waitFor();
  await page
    .getByRole("button", {
      name: "Reinterpret these cards with current content",
    })
    .click();
  await page.getByRole("heading", { name: "The whole reading" }).waitFor();
  assert.equal(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("pxoracle.tarot.v2")).readingVersions
          .content,
    ),
    "reading.en.999",
  );
  await page.getByRole("button", { name: "Save reading", exact: true }).click();
  assert.deepEqual(
    (
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("pxoracle.tarot.v2")),
      )
    ).draw,
    JSON.parse(saved).draw,
  );
  await page.getByRole("button", { name: "Delete saved reading" }).click();
  assert.equal(
    await page.evaluate(
      () =>
        localStorage.getItem("pxoracle.tarot.v2") ??
        localStorage.getItem("pxoracle.tarot.v1"),
    ),
    null,
  );
  report.checks.push(
    "Unavailable pinned version explicitly regenerates with unchanged cards; no auto-overwrite; deletion removes both envelopes",
  );
  const mobile = await setup({ width: 390, height: 844 });
  await mobile.page.goto(base + "/tarot/");
  await mobile.page.getByLabel("Topic", { exact: true }).selectOption("growth");
  await mobile.page.getByLabel("Include reversed cards").check();
  await draw(mobile.page);
  await mobile.page
    .getByRole("heading", { name: "The whole reading" })
    .waitFor();
  assert.equal(
    await mobile.page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    true,
  );
  await mobile.page.locator("h3").first().click();
  await mobile.page
    .locator(".structured-reading")
    .screenshot({ path: output + "/mobile-reading.png" });
  report.checks.push(
    "390x844 mobile emulation: full draw/reveal/reading, no horizontal overflow",
  );
  // Reuse a real saved draw to test abandonment while prose is pending.
  await context.unroute("**/content/reading/rules.1.json");
  await page.evaluate(
    (raw) => localStorage.setItem("pxoracle.tarot.v2", raw),
    saved,
  );
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  let started;
  const seen = new Promise((resolve) => {
    started = resolve;
  });
  await context.route("**/content/reading/reading.en.1.json", async (route) => {
    started();
    await held;
    await route.continue().catch(() => {});
  });
  await page.reload();
  await page.getByRole("button", { name: "Resume a saved reading" }).click();
  await seen;
  await page.getByRole("link", { name: "The room", exact: true }).click();
  await page.waitForURL(base + "/");
  release();
  await context.unroute("**/content/reading/reading.en.1.json");
  await page.getByRole("link", { name: "Tarot", exact: true }).click();
  await page.getByRole("heading", { name: "The whole reading" }).waitFor();
  assert.equal(await page.locator(".structured-reading").innerText(), result);
  report.checks.push(
    "SPA navigation abandons pending interpretation; returning resumes the same pinned draw without stale errors",
  );
  // One-card reflection never needs the structured interpretation packs.
  const single = await setup({ width: 1280, height: 800 });
  const singleRequests = [];
  single.page.on("request", (r) => singleRequests.push(r.url()));
  await single.page.goto(base + "/tarot/");
  await single.page.getByLabel("Your spread").selectOption("1");
  await single.page.getByRole("button", { name: "Shuffle the deck" }).click();
  const one = single.page.getByRole("button", {
    name: "Choose slot 1",
    exact: true,
  });
  await one.waitFor();
  await one.click();
  await single.page.locator('.tarot-layout[data-phase="reading"]').waitFor();
  assert.equal(
    singleRequests.some((u) => u.includes("/content/reading/")),
    false,
  );
  report.checks.push(
    "One-card reflection retains its separate flow and does not download interpretation packs",
  );
  await single.context.close();
  await mobile.context.close();
  await context.close();
} catch (error) {
  console.error(error);
  throw error;
} finally {
  writeFileSync(
    output + "/browser.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  await browser.close();
}
assert.deepEqual(report.errors, []);
console.log(JSON.stringify(report, null, 2));
