import { test, expect, type Page } from "@playwright/test";
import { graphicsAvailable } from "./tarot-support";

test.use({ reducedMotion: "reduce" });

async function selectSeoul(page: Page) {
  await page.goto("/astrology/");
  await page.getByRole("button", { name: "Natal Chart" }).click();
  await page.locator(".oracle-bubble").getByRole("button", { name: "Begin a new chart" }).click();
  await page.getByLabel("Birth country").selectOption("KR");
  await page.getByLabel("Birth city", { exact: true }).fill("Seoul");
  await page.getByRole("button", { name: /Seoul.*Seoul.*South Korea/ }).click();
  await expect(page.locator(".place-confirmation")).toContainText("Asia/Seoul");
}

async function calculateAndVerifyAtlasRecord(page: Page) {
  await page.getByRole("button", { name: "Confirm birthplace" }).click();
  await expect(page.locator(".natal-layout")).toHaveAttribute("data-stage", "details");
  await page.getByLabel("Birth date", { exact: true }).fill("2000-01-01");
  await page.getByLabel("Local birth time").fill("12:00");
  await page.getByRole("button", { name: "Review the details" }).click();
  await page.getByRole("button", { name: "Calculate and enter the crystal" }).click();
  await expect(page.getByRole("heading", { name: "A first look at your map" })).toBeVisible({ timeout: 60000 });
  await expect(page.getByText("Asia/Seoul · UTC+09:00", { exact: false })).toBeVisible();
  // Verify the real calculated and explicitly saved payload, not only the confirmation copy.
  await page.getByRole("button", { name: "Save on this device" }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("pxoracle.natal-report.v1")!));
  expect(saved.input).toMatchObject({ timezone: "Asia/Seoul", latitude: 37.566, longitude: 126.9784 });
  expect(saved.chart.provenance.settings).toMatchObject({ timezone: "Asia/Seoul", latitude: 37.566, longitude: 126.9784 });
  expect(saved.place).toMatchObject({ source: "atlas", country: "KR", cityId: "1835848" });
  expect(saved.place.label).toContain("Seoul");
}

test("a retained city survives route remount with matching submitted coordinates", async ({ page }) => {
  await selectSeoul(page);
  await page.getByRole("link", { name: /Back to the room/ }).click();
  await expect(page).toHaveURL(/^https?:\/\/[^/]+\/$/);
  await page.goBack();
  // Reentry begins at the table; the browsed country and candidate city survive into the next globe visit.
  await expect(page.getByRole("button", { name: "Natal Chart" })).toBeVisible();
  await page.getByRole("button", { name: "Natal Chart" }).click();
  await page.locator(".oracle-bubble").getByRole("button", { name: "Begin a new chart" }).click();
  await expect(page.getByLabel("Birth country")).toHaveValue("KR");
  await expect(page.locator(".place-confirmation")).toContainText("Asia/Seoul");
  await page.getByRole("button", { name: "Enter or adjust coordinates" }).click();
  await expect(page.getByLabel("Birthplace time zone")).toHaveValue("Asia/Seoul");
  await expect(page.getByLabel("Latitude", { exact: true })).toHaveValue("37.566");
  await expect(page.getByLabel("Longitude", { exact: true })).toHaveValue("126.9784");
  await page.getByRole("button", { name: "Search a city", exact: true }).click();
  await calculateAndVerifyAtlasRecord(page);
});

test("returning from manual edits submits the confirmed atlas city and its provenance together", async ({ page }) => {
  await selectSeoul(page);
  await page.getByRole("button", { name: "Enter or adjust coordinates" }).click();
  await page.getByLabel("Birthplace time zone").fill("America/New_York");
  await page.getByLabel("Latitude", { exact: true }).fill("40");
  await page.getByLabel("Longitude", { exact: true }).fill("-74");
  await page.getByRole("button", { name: "Search a city", exact: true }).click();
  await expect(page.locator(".place-confirmation")).toContainText("37.566°");
  await calculateAndVerifyAtlasRecord(page);
});

test("the room globe opens birthplace editing from an existing chart without changing its saved copy", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chrome", "Fixed desktop Chrome pointer target; mobile and other engines retain the two form regressions.");
  await page.setViewportSize({ width: 1440, height: 900 });
  await selectSeoul(page);
  test.skip(!(await graphicsAvailable(page)), "Actual globe mouse selection requires WebGL.");
  await calculateAndVerifyAtlasRecord(page);
  const savedBefore = await page.evaluate(() => localStorage.getItem("pxoracle.natal-report.v1"));
  await page.getByRole("link", { name: /Back to the room/ }).click();
  await expect(page).toHaveURL(/^https?:\/\/[^/]+\/$/);
  // URL and old canvas opacity can update before the replacement scene's first frame.
  await expect(page.locator('.scene-host[data-route="landing"]')).toHaveAttribute("data-ready", "true");
  await expect(page.locator(".scene-status")).toHaveCount(0);
  await page.waitForFunction(() => document.querySelector("canvas")?.style.opacity === "1");
  // The public globe surface at this fixed room viewport, using an actual mouse event.
  // Dispatching directly to the canvas would miss a blocking HTML overlay regression.
  await expect.poll(() => page.evaluate(() => document.elementFromPoint(671, 431)?.tagName)).toBe("CANVAS");
  await page.mouse.click(671, 431);
  await expect(page).toHaveURL(/\/astrology\/$/);
  await expect(page.locator(".natal-layout")).toHaveAttribute("data-presentation", "globe");
  await expect(page.getByLabel("Birth country")).toBeVisible();
  await expect(page.getByRole("button", { name: "Search a city", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Room view", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Find your beginning." })).toBeVisible();
  await expect(page.locator('.scene-host[data-route="astrology"]')).toHaveAttribute("data-ready", "true");
  await expect(page.locator(".scene-status")).toHaveCount(0);
  const stage = page.locator(".natal-stage");
  await expect(stage).toHaveAttribute("data-settled", "true");
  const approached = await stage.screenshot({ animations: "disabled", style: ".natal-scene-caption { visibility: hidden !important; }" });
  await page.getByRole("button", { name: "Room view", exact: true }).click();
  await expect(page.getByRole("button", { name: "Room view", exact: true })).toHaveCount(0);
  // Returning keeps the confirmed place and the entered date/time; the chart remains resumable.
  await expect(page.locator(".natal-layout")).toHaveAttribute("data-stage", "details");
  await expect(page.getByLabel("Birth date", { exact: true })).toHaveValue("2000-01-01");
  await expect(page.getByLabel("Local birth time")).toHaveValue("12:00");
  // Reduced motion makes the changed shot settle immediately after the next render.
  await page.waitForTimeout(350);
  const roomShot = await stage.screenshot({ animations: "disabled", style: ".natal-scene-caption { visibility: hidden !important; }" });
  expect(approached.equals(roomShot), "Globe entry must approach a different view from the room").toBe(false);
  expect(await page.evaluate(() => localStorage.getItem("pxoracle.natal-report.v1"))).toBe(savedBefore);
});
