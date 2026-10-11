import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
test("review stage and detail compositions on desktop and mobile", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  mkdirSync("docs/validation/tarot-table-v2/frames", { recursive: true });
  for (const mobile of [false, true]) {
    await page.setViewportSize(
      mobile ? { width: 390, height: 700 } : { width: 1100, height: 800 },
    );
    for (const shot of ["shuffle", "selection", "reveal", "reading", "detail"]) {
      await page.goto(
        `/iframe.html?id=pxoracle-tarot-table--frame-${shot}&viewMode=story`,
      );
      await expect(page.getByText(/FIXED FRAME FOR REVIEW/)).toBeVisible();
      await expect(page.locator(".scene-status")).toHaveCount(0, {
        timeout: 20000,
      });
      await page.waitForTimeout(700);
      const before = await page.locator("canvas").boundingBox();
      await page.waitForTimeout(350);
      expect(await page.locator("canvas").boundingBox()).toEqual(before);
      await page.screenshot({
        path: `docs/validation/tarot-table-v2/frames/${mobile ? "mobile" : "desktop"}-${shot}.png`,
      });
    }
  }
  expect(errors).toEqual([]);
});
