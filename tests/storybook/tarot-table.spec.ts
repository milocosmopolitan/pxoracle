import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
test("articulated hand replay and fixed carry use production meshes without WASM", async ({
  page,
}) => {
  const engines: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/engines/")) engines.push(r.url());
  });
  mkdirSync("docs/validation/tarot-table-v2", { recursive: true });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.goto(
    "/iframe.html?id=pxoracle-tarot-table--hand-pick-place-flip&viewMode=story",
  );
  await expect(page.locator(".scene-status")).toHaveCount(0, { timeout: 45000 });
  await expect(page.getByText(/No WASM · reading/)).toBeVisible({
    timeout: 20000,
  });
  await page.getByRole("button", { name: "Replay", exact: true }).click();
  await expect(page.getByText(/No WASM · reading/)).toBeVisible({
    timeout: 20000,
  });
  await page.screenshot({
    path: "docs/validation/tarot-table-v2/hand-revealed.png",
  });
  await page.goto(
    "/iframe.html?id=pxoracle-tarot-table--frame-carry&viewMode=story",
  );
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect(page.locator(".scene-status")).toHaveCount(0, {
    timeout: 45000,
  });
  await page.waitForTimeout(300);
  await page.screenshot({
    path: "docs/validation/tarot-table-v2/hand-carry.png",
  });
  expect(engines).toEqual([]);
});

for (const story of [
  "camera-transition",
  "shuffle",
  "selection",
  "upright",
  "reversed",
  "three-cards",
  "mobile",
  "loading-failure",
  "restored",
  "reduced-motion",
]) {
  test(`table story ${story} loads and completes its controls without WASM`, async ({
    page,
  }) => {
    const engines: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/engines/")) engines.push(r.url());
    });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    mkdirSync("docs/validation/tarot-table-v2", { recursive: true });
    await page.setViewportSize(
      story === "mobile"
        ? { width: 390, height: 844 }
        : { width: 1100, height: 800 },
    );
    await page.goto(
      `/iframe.html?id=pxoracle-tarot-table--${story}&viewMode=story`,
    );
    await expect(page.locator("canvas")).toHaveCount(1);
    await expect(
      page.getByText(/STORYBOOK · Synthetic fixed cards/),
    ).toBeVisible();
    await expect(page.locator(".scene-status")).toHaveCount(0, {
      timeout: 20000,
    });
    if (story === "loading-failure") {
      await page.getByRole("button", { name: "Retry same card" }).click();
      await expect(page.getByText(/No WASM · reading/)).toBeVisible({
        timeout: 20000,
      });
    }
    if (story === "camera-transition") {
      await page.screenshot({
        path: "docs/validation/tarot-table-v2/conversation.png",
      });
      for (let i = 0; i < 2; i++) {
        await page
          .getByRole("button", { name: "Conversation / table" })
          .click();
        const canvasBounds = await page.locator("canvas").boundingBox();
        await page.waitForTimeout(1100);
        await page.screenshot({
          path: "docs/validation/tarot-table-v2/approach.png",
        });
        await expect(page.getByText(/No WASM · selecting/)).toBeVisible({
          timeout: 20000,
        });
        expect(await page.locator("canvas").boundingBox()).toEqual(
          canvasBounds,
        );
        await page
          .getByRole("button", { name: "Conversation / table" })
          .click();
        await expect(page.getByText(/No WASM · conversation/)).toBeVisible();
      }
    }
    expect(engines).toEqual([]);
  });
}
