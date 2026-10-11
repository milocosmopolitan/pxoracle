import { expect, type Locator, type Page } from "@playwright/test";

// Hosted Firefox may lack WebGL. Exercise the explicit DOM progression there.
export async function settleTarot(page: Page, target: Locator) {
  await expect.poll(async () => {
    if (await target.isVisible()) return true;
    const status = (await page.locator(".scene-status").allTextContents()).join(" ");
    if (/cannot start WebGL|Graphics unavailable/.test(status ?? "")) {
      const summary = page.getByText("Animation or graphics unavailable?", { exact: true });
      const next = page.getByRole("button", { name: "Continue with text reading" });
      if (await summary.isVisible()) {
        if (!(await next.isVisible())) await summary.click();
        if (await next.isEnabled()) await next.click();
      }
    }
    return false;
  }, { timeout: 25000 }).toBe(true);
}

export async function graphicsAvailable(page: Page) {
  return page.evaluate(() => {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return !!gl;
  });
}
