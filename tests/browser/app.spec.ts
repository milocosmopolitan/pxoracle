import { test, expect } from "@playwright/test";
test("static direct routes, feature-only WASM, tarot restore and history", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Some answers",
  );
  await page.waitForTimeout(1000);
  expect(requests.filter((x) => x.endsWith(".wasm"))).toEqual([]);
  await page
    .getByRole("link", { name: "Let the cards speak", exact: false })
    .click();
  await page.getByRole("button", { name: "Shuffle the deck" }).click();
  await expect(
    page.getByRole("button", { name: "Choose slot 1", exact: true }),
  ).toBeVisible();
  for (const n of [1, 13, 78])
    await page
      .getByRole("button", { name: `Choose slot ${n}`, exact: true })
      .click();
  for (const n of [1, 2, 3])
    await page
      .getByRole("button", { name: `Reveal card ${n}`, exact: true })
      .click();
  await expect(
    page.getByRole("heading", { name: "Let the images settle." }),
  ).toBeVisible();
  expect(requests.some((x) => x.includes("/tarot/engine.wasm"))).toBeTruthy();
  expect(
    requests.some((x) => x.includes("/astrology/engine.wasm")),
  ).toBeFalsy();
  await page.getByRole("button", { name: "Save reading", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Resume a saved reading" }).click();
  await expect(
    page.getByRole("heading", { name: "Let the images settle." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "The room", exact: true }).click();
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Make a little room",
  );
});
test("real astrology worker and explicit unknown time", async ({ page }) => {
  const wasm: string[] = [];
  page.on("request", (r) => {
    if (r.url().endsWith(".wasm")) wasm.push(r.url());
  });
  await page.goto("/astrology/");
  await page.getByLabel("Birth date", { exact: true }).fill("2000-01-01");
  await page.getByLabel("Local birth time").fill("12:00");
  await page.getByLabel("Birthplace time zone").fill("UTC");
  await page.getByLabel("Latitude", { exact: true }).fill("0");
  await page.getByLabel("Longitude", { exact: true }).fill("0");
  await page.getByRole("button", { name: "Enter the crystal" }).click();
  await expect(
    page.getByRole("heading", { name: "Your celestial map" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /sun.*Capricorn/i }),
  ).toBeVisible();
  expect(wasm.some((x) => x.includes("/astrology/"))).toBeTruthy();
  expect(wasm.some((x) => x.includes("/tarot/"))).toBeFalsy();
});
test("failed engine initialization offers a working retry", async ({
  page,
}) => {
  let fail = true;
  await page.route("**/tarot/engine.wasm", (route) =>
    fail ? route.abort() : route.continue(),
  );
  await page.goto("/tarot/");
  await page.getByRole("button", { name: "Shuffle the deck" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Shuffle the deck" }).click();
  await expect(
    page.getByRole("button", { name: "Choose slot 1", exact: true }),
  ).toBeVisible();
});
test("rapid route changes keep a single canvas and usable keyboard navigation", async ({
  page,
}) => {
  await page.goto("/");
  for (let n = 0; n < 3; n++) {
    await page.getByRole("link", { name: "Astrology", exact: true }).click();
    await page.getByRole("link", { name: "Tarot", exact: true }).click();
    await page.getByRole("link", { name: "The room", exact: true }).click();
  }
  await expect(page.locator("canvas")).toHaveCount(1);
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toHaveCount(1);
});
