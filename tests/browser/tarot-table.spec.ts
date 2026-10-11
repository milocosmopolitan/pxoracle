import { test, expect } from "@playwright/test";
import { graphicsAvailable } from "./tarot-support";
test.beforeEach(async ({ page }) => {
  test.skip(
    !(await graphicsAvailable(page)),
    "Mesh tests require WebGL2; app.spec exercises the explicit HTML fallback.",
  );
});

test("real tarot: sequential reveal, bounded face loading, same-card retry and restore", async ({
  page,
}) => {
  const faces: string[] = [];
  let fail = true;
  await page.route("**/art/cards/*", (route) => {
    faces.push(route.request().url());
    return fail ? route.abort() : route.continue();
  });
  await page.goto("/tarot/");
  await page.getByLabel("Your spread").selectOption("1");
  await page.getByRole("button", { name: "Shuffle the deck" }).click();
  await expect(
    page.getByRole("button", { name: "Choose slot 1", exact: true }),
  ).toBeVisible({ timeout: 45000 });
  await expect(page.getByRole("heading", { name: "0 of 1 cards selected", exact: true })).toBeVisible();
  expect(faces).toHaveLength(0);
  await page.getByRole("button", { name: "Shuffle again" }).click();
  await page
    .getByRole("button", { name: "Choose slot 1", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Retry same card" }),
  ).toBeVisible({ timeout: 60000 });
  expect(new Set(faces).size).toBe(1);
  fail = false;
  await page.getByRole("button", { name: "Retry same card" }).click();
  await expect(
    page.getByRole("heading", { name: "Let the images settle." }),
  ).toBeVisible({ timeout: 60000 });
  expect(new Set(faces).size).toBe(1);
  await expect(page.locator(".tarot-panel img")).toHaveCount(0);
  await page.getByRole("button", { name: "Save reading", exact: true }).click();
  const saved = await page.evaluate(() =>
    localStorage.getItem("pxoracle.tarot.v2"),
  );
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: test.info().outputPath("reading.png"),
    fullPage: false,
  });
  await page.reload();
  await page.getByRole("button", { name: "Resume a saved reading" }).click();
  await expect(
    page.getByRole("heading", { name: "Let the images settle." }),
  ).toBeVisible({ timeout: 60000 });
  expect(
    await page.evaluate(() => localStorage.getItem("pxoracle.tarot.v2")),
  ).toBe(saved);
  await page.getByRole("button", { name: "Delete saved reading" }).click();
  expect(
    await page.evaluate(() => localStorage.getItem("pxoracle.tarot.v2")),
  ).toBeNull();
});

test("standard motion camera, keyboard highlight, route cancellation and three-card reading", async ({
  page,
  isMobile,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/tarot/");
  await page.getByRole("button", { name: "Shuffle the deck" }).click();
  await expect(
    page.getByRole("button", { name: "Choose slot 1", exact: true }),
  ).toBeVisible({ timeout: 45000 });
  const first = page.getByRole("button", {
    name: "Choose slot 1",
    exact: true,
  });
  await first.focus();
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({
    path: test.info().outputPath("selection.png"),
    fullPage: false,
  });
  await page.keyboard.press("Enter");
  await page.getByRole("link", { name: "The room", exact: true }).click();
  await page.getByRole("link", { name: "Tarot", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Choose slot 2", exact: true }),
  ).toBeVisible({ timeout: 60000 });
  await page
    .getByRole("button", { name: "Choose slot 2", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Choose slot 3", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Let the images settle." }),
  ).toBeVisible({ timeout: 60000 });
  await expect(page.locator(".reading-card")).toHaveCount(3);
  await expect(page.locator("canvas")).toHaveCount(1);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(1000);
  const bounds = (await page.locator("canvas").boundingBox())!;
  const cardX = bounds.x + (bounds.width - (isMobile ? 0 : 380)) / 2;
  const cardY = bounds.y + bounds.height / 2;
  if (isMobile) await page.touchscreen.tap(cardX, cardY);
  else await page.mouse.click(cardX, cardY);
  await expect(page.getByRole("button", { name: "Look closer at card 2", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Show all cards", exact: true }).click();
  await page
    .getByRole("button", { name: "Look closer at card 2", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Look closer at card 2", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(await page.locator("canvas").boundingBox()).toEqual(bounds);
  await page
    .getByRole("button", { name: "Show all cards", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Show all cards", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: test.info().outputPath("three-card-reading.png"),
    fullPage: false,
  });
  await page.getByRole("button", { name: "New reading" }).click();
  await expect(
    page.getByRole("button", { name: "Shuffle the deck" }),
  ).toBeVisible({ timeout: 60000 });
});

test("Mesh picking ignores a drag and accepts a click or touch", async ({
  page,
  isMobile,
}) => {
  await page.goto("/tarot/");
  await page.getByRole("button", { name: "Shuffle the deck" }).click();
  await expect(
    page.getByRole("button", { name: "Choose slot 1", exact: true }),
  ).toBeVisible({ timeout: 45000 });
  const box = (await page.locator("canvas").boundingBox())!;
  const x = box.x + box.width * (isMobile ? 0.24 : 0.3),
    y = box.y + box.height * (isMobile ? 0.34 : 0.3);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 80, y + 40, { steps: 5 });
  await page.mouse.up();
  await expect(
    page.getByRole("heading", { name: "0 of 3 cards selected" }),
  ).toBeVisible();
  if (isMobile) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
  await expect(
    page.getByRole("heading", { name: "1 of 3 cards selected" }),
  ).toBeVisible();
});
