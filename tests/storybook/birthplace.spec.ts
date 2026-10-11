import { test, expect } from "@playwright/test";

test("production birthplace camera midpoint is stable and distinct from the completed approach", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [], engines: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (request.url().includes("/engines/")) engines.push(request.url()); });
  const capture = async (story: string) => {
    await page.goto(`/iframe.html?id=pxoracle-birthplace-journey--${story}&viewMode=story`);
    await expect(page.locator('.scene-host[data-route="astrology"]')).toHaveAttribute("data-ready", "true", { timeout: 60000 });
    await expect(page.getByRole("button", { name: "Room view", exact: true })).toBeVisible();
    // The midpoint intentionally starts on the first ready frame; let its dirty draw complete.
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const stage = page.locator(".natal-stage");
    const first = await stage.screenshot({ animations: "disabled" });
    await page.waitForTimeout(300);
    const second = await stage.screenshot({ animations: "disabled", path: test.info().outputPath(`${story}.png`) });
    expect(second.equals(first), "Fixed review framing must not drift").toBe(true);
    return second;
  };
  const midpoint = await capture("room-to-globe-midpoint");
  await expect(page.getByText("Camera midpoint (50%); globe orientation settled", { exact: false })).toBeVisible();
  const completed = await capture("reduced-motion");
  expect(midpoint.equals(completed), "The midpoint must differ from the completed camera approach").toBe(false);
  expect(errors).toEqual([]);
  expect(engines).toEqual([]);
});
