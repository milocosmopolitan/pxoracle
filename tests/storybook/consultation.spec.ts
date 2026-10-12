import { test, expect } from "@playwright/test";

const stories = {
  hub: { bubble: "Shall we look at the sky you were born under" },
  "hub-with-current-chart": { button: "Resume the current chart" },
  horoscopes: { bubble: "Horoscopes are not ready" },
  "natal-no-save": { bubble: "No chart is kept on this device", button: "Begin a new chart" },
  "natal-saved-chart": { bubble: "I have a chart you saved here from Seoul", button: "Open saved chart" },
  "natal-legacy-save": { bubble: "older saved chart", button: "Open saved chart" },
  "natal-input-only-save": { bubble: "only your saved birth details", button: "Review saved details" },
  "natal-unsupported-save": { bubble: "no longer supports", button: "Open saved chart" },
  "natal-corrupt-save": { bubble: "cannot read it", button: "Delete the unreadable save" },
  "natal-storage-unavailable": { bubble: "will not let me look at saved charts", button: "Begin a new chart" },
  "unsaved-chart-resume": { bubble: "No chart is kept on this device", button: "Resume the current chart" },
  "birth-details-at-table": { heading: "When were you born?", bubble: "Born in Seoul, Seoul, South Korea" },
  "birth-review": { heading: "Is this right?", bubble: "read that back" },
  "crystal-with-return": { heading: "Seoul, Seoul, South Korea", button: "Return to the table" },
} as const;

test("consultation stories use production components and never load WASM", async ({ page }) => {
  test.setTimeout(300000);
  const engines: string[] = [], errors: string[] = [];
  page.on("request", (r) => { if (r.url().includes("/engines/")) engines.push(r.url()); });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  for (const [name, expected] of Object.entries(stories)) {
    await page.goto(`/iframe.html?id=pxoracle-consultation--${name}&viewMode=story`);
    await expect(page.getByText("Production consultation · Synthetic saved data", { exact: false })).toBeVisible();
    if ("heading" in expected) await expect(page.getByRole("heading", { name: expected.heading })).toBeVisible();
    if ("bubble" in expected) await expect(page.locator(".oracle-bubble")).toContainText(expected.bubble);
    if ("button" in expected) await expect(page.getByRole("button", { name: expected.button }).first()).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(1);
    await page.screenshot({ path: test.info().outputPath(`${name}.png`), scale: "css" });
  }
  // The saved path opens the crystal without a globe phase; the return keeps the chart.
  await page.goto("/iframe.html?id=pxoracle-consultation--natal-saved-chart&viewMode=story");
  await page.locator(".oracle-bubble").getByRole("button", { name: "Open saved chart" }).click();
  await expect(page.locator(".natal-layout")).toHaveAttribute("data-presentation", "crystal");
  await expect(page.locator(".natal-layout")).toHaveAttribute("data-globe-phase", "crystal");
  await page.getByRole("button", { name: "Return to the table" }).first().click();
  await expect(page.locator(".natal-layout")).toHaveAttribute("data-presentation", "table");
  await expect(page.getByRole("button", { name: "Resume the current chart" })).toBeVisible();
  // Mobile: the bubble sits below the stage, never over the oracle.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/iframe.html?id=pxoracle-consultation--mobile&viewMode=story");
  await expect(page.locator(".oracle-bubble")).toContainText("I have a chart you saved here");
  const bubble = await page.locator(".oracle-bubble").boundingBox();
  const stage = await page.locator(".natal-stage").boundingBox();
  expect(bubble!.y).toBeGreaterThanOrEqual(stage!.y + stage!.height - 1);
  await page.screenshot({ path: test.info().outputPath("mobile.png"), scale: "css" });
  expect(engines).toEqual([]);
  expect(errors).toEqual([]);
});
