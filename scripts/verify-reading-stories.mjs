import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
const errors = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  for (const name of [
    "representative",
    "all-reversed",
    "weak-relationship",
    "complement",
    "repeated-theme",
    "mobile",
    "keyboard",
    "all-twelve-perspectives",
    "error-and-retry",
    "legacy-session",
    "unsupported-version",
  ]) {
    await page.goto(
      `http://127.0.0.1:6180/iframe.html?id=pxoracle-free-reading--${name}&viewMode=story`,
    );
    if (name === "error-and-retry")
      await page.getByRole("button", { name: "Retry reflection" }).click();
    if (name === "unsupported-version")
      await page
        .getByRole("button", {
          name: "Reinterpret these cards with current content",
        })
        .click();
    if (name === "legacy-session")
      await page.getByRole("button", { name: "Use this perspective" }).click();
    await page.getByRole("heading", { name: "The whole reading" }).waitFor();
    if (name === "weak-relationship")
      await page
        .getByText("No strong relationship rule connected these cards.", {
          exact: false,
        })
        .waitFor();
    if (name === "all-reversed")
      assert.equal(
        await page
          .locator(".reading-card small")
          .filter({ hasText: "reversed" })
          .count(),
        3,
      );
    if (name === "keyboard") {
      const button = page.locator(".reading-card button").nth(2);
      await button.focus();
      await page.keyboard.press("Enter");
      assert.equal(await button.getAttribute("aria-pressed"), "true");
    }
    if (name === "all-twelve-perspectives")
      for (const topic of ["relationships", "work", "creativity", "growth"])
        for (const intent of ["present", "crossroads", "action"]) {
          await page.getByLabel("Topic", { exact: true }).selectOption(topic);
          await page.getByLabel("Intention").selectOption(intent);
          await page
            .getByRole("heading", { name: "The whole reading" })
            .waitFor();
        }
    checks.push(name);
  }
  const requests = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto(
    "http://127.0.0.1:6180/iframe.html?id=pxoracle-scenes--tarot-reading&viewMode=story",
  );
  await page.getByRole("heading", { name: "The whole reading" }).waitFor();
  assert.equal(
    requests.some((u) => u.includes("/engines/")),
    false,
  );
  checks.push("Existing tarot scene: injected native fixture, no real WASM");
  await page.screenshot({
    path: "docs/validation/reading/storybook.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
} finally {
  writeFileSync(
    "docs/validation/reading/storybook.json",
    JSON.stringify({ browser: browser.version(), checks, errors }, null, 2) +
      "\n",
  );
  await browser.close();
}
console.log(checks);
