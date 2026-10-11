import { test, expect } from "@playwright/test";

test("natal reports and retry stories use production components without WASM", async ({
  page,
}) => {
  const errors: string[] = [],
    requests: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => requests.push(r.url()));
  for (const name of [
    "whole-report",
    "approximate",
    "unknown-moon-boundary",
    "polar",
    "no-major-relationships",
    "wide-orbs",
    "generational",
    "mobile-report",
    "keyboard-report",
    "error-and-retry",
    "legacy-session",
    "restored-session",
    "unavailable-version",
  ]) {
    await page.setViewportSize(
      name === "mobile-report"
        ? { width: 390, height: 844 }
        : { width: 1280, height: 900 },
    );
    await page.goto(
      `/iframe.html?id=pxoracle-natal-reading--${name}&viewMode=story`,
    );
    if (name === "error-and-retry")
      await page
        .getByRole("button", { name: "Retry interpretation for this chart" })
        .click();
    if (name === "legacy-session" || name === "unavailable-version")
      await page
        .getByRole("button", { name: "Generate interpretation", exact: true })
        .click();
    if (
      [
        "error-and-retry",
        "legacy-session",
        "restored-session",
        "unavailable-version",
      ].includes(name)
    )
      await page.getByRole("button", { name: "Read full HTML report" }).click();
    await expect(
      page.getByRole("article", { name: "Full natal report" }),
    ).toContainText("Terms and limits");
    if (name === "unknown-moon-boundary")
      await expect(page.getByRole("article")).toContainText(
        "conditional sample",
      );
    if (name === "keyboard-report") {
      await page
        .getByRole("button", { name: "Show in the crystal" })
        .first()
        .focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("status")).toContainText("sun");
    }
  }
  expect(errors).toEqual([]);
  expect(requests.some((url) => url.includes("/engines/"))).toBe(false);
});

test("same-scene camera stories expose overview, body and relationship selection", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const name of [
    "chart-overview",
    "planet-detail",
    "relationship-detail",
    "camera-sequence",
    "mobile-camera",
    "reduced-motion",
    "unknown-time-camera",
    "crowded-markers",
  ]) {
    await page.setViewportSize(
      name === "mobile-camera"
        ? { width: 390, height: 844 }
        : { width: 1100, height: 900 },
    );
    await page.goto(
      `/iframe.html?id=pxoracle-natal-reading--${name}&viewMode=story`,
    );
    await expect(page.locator("canvas")).toHaveCount(1);
    await expect(page.locator(".scene-status")).toHaveCount(0);
    await page.getByRole("button", { name: "Approach the crystal" }).click();
    await expect(page.getByRole("status")).toHaveText("chart");
    await page.getByRole("button", { name: "Moon detail" }).click();
    await expect(page.getByRole("status")).toContainText("moon");
    if (!["unknown-time-camera", "crowded-markers"].includes(name)) {
      await page.getByRole("button", { name: "Sun–Saturn" }).click();
      await expect(page.getByRole("status")).toContainText("aspect");
    }
    await page
      .getByRole("button", { name: "Whole chart", exact: true })
      .click();
    await expect(page.getByRole("status")).toHaveText("chart");
    await page.screenshot({
      path: test.info().outputPath(`${name}.png`),
      scale: "css",
    });
  }
  expect(errors).toEqual([]);
});
