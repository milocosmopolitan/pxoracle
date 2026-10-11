import { test, expect } from "@playwright/test";
test("A B C use the same assets at desktop and mobile sizes", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const mobile of [false, true]) {
    await page.setViewportSize(mobile ? { width: 390, height: 640 } : { width: 1100, height: 800 });
    for (const profile of ["a", "b", "c"]) {
      await page.goto(`/iframe.html?id=pxoracle-tarot-table--camera-${profile}&viewMode=story`);
      await expect(page.getByText(/No WASM · selecting/)).toBeVisible();
      await expect(page.locator(".scene-status")).toHaveCount(0, { timeout: 20000 });
      await page.screenshot({ path: test.info().outputPath(`${mobile ? "mobile" : "desktop"}-${profile}.png`) });
    }
  }
});
