import { test, expect } from "@playwright/test";
import { settleTarot } from "./tarot-support";
async function draw(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Shuffle the deck" }).click();
  for (let n = 1; n <= 3; n++) {
    const button = page.getByRole("button", {
      name: `Choose slot ${n}`,
      exact: true,
    });
    await settleTarot(page, button);
    await button.click();
    await expect(
      page.getByRole("heading", {
        name: `${n} of 3 cards selected`,
        exact: true,
      }),
    ).toBeVisible();
  }
  await settleTarot(
    page,
    page.getByRole("heading", { name: "Let the images settle." }),
  );
}
test("structured reading retries content without changing the draw, persists its perspective and excludes the note", async ({
  page,
}) => {
  let fail = true;
  await page.route("**/content/reading/reading.en.1.1.json", (route) =>
    fail
      ? route.fulfill({ status: 503, body: "unavailable" })
      : route.continue(),
  );
  await page.goto("/tarot/");
  await page.getByRole("textbox").fill("PRIVATE_READING_SENTINEL");
  await page.getByLabel("Topic", { exact: true }).selectOption("work");
  await page.getByLabel("Intention").selectOption("crossroads");
  await draw(page);
  await expect(
    page.getByRole("button", { name: "Retry reflection" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save reading", exact: true }).click();
  const before = await page.evaluate(() =>
    localStorage.getItem("pxoracle.tarot.v2"),
  );
  fail = false;
  await page.getByRole("button", { name: "Retry reflection" }).click();
  await expect(
    page.getByRole("heading", { name: "The whole reading" }),
  ).toBeVisible();
  const reading = await page.locator(".structured-reading").innerText();
  await expect(page.locator(".structured-reading .reading-card")).toHaveCount(
    3,
  );
  await page.getByRole("button", { name: "Save reading", exact: true }).click();
  const after = await page.evaluate(() =>
    localStorage.getItem("pxoracle.tarot.v2"),
  );
  expect(after).not.toContain("PRIVATE_READING_SENTINEL");
  expect(JSON.parse(after!).draw).toEqual(JSON.parse(before!).draw);
  expect(JSON.parse(after!).perspective).toEqual({
    topic: "work",
    intent: "crossroads",
  });
  await page.reload();
  await page.getByRole("button", { name: "Resume a saved reading" }).click();
  await expect
    .poll(() => page.locator(".structured-reading").innerText())
    .toBe(reading);
});
test("legacy perspective is explicit and corrupt v2 does not silently restore v1", async ({
  page,
}) => {
  await page.goto("/tarot/");
  await draw(page);
  await page.getByRole("button", { name: "Save reading", exact: true }).click();
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("pxoracle.tarot.v2")!);
    localStorage.setItem(
      "pxoracle.tarot.v1",
      JSON.stringify({ schemaVersion: 1, value: saved.draw }),
    );
    localStorage.setItem("pxoracle.tarot.v2", "broken");
  });
  await page.reload();
  await page.getByRole("button", { name: "Resume a saved reading" }).click();
  await expect(
    page.getByText("The saved reading could not be read."),
  ).toBeVisible();
  await page.evaluate(() => localStorage.removeItem("pxoracle.tarot.v2"));
  await page.getByRole("button", { name: "Resume a saved reading" }).click();
  await expect(
    page.getByRole("button", { name: "Use this perspective" }),
  ).toBeVisible();
  await expect(page.locator(".structured-reading")).toHaveCount(0);
  await page.getByRole("button", { name: "Use this perspective" }).click();
  await expect(
    page.getByRole("heading", { name: "The whole reading" }),
  ).toBeVisible();
});


test("release-one reading preserves cards until explicit reinterpretation and save", async ({page}, testInfo) => {
  await page.goto("/tarot/");
  await draw(page);
  await expect(page.getByRole("heading", {name:"The whole reading"})).toBeVisible();
  await page.getByRole("button", {name:"Save reading",exact:true}).click();
  const old = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("pxoracle.tarot.v2")!);
    saved.readingVersions = {schema:1,engine:"reading.1",semantics:"semantics.1",rules:"rules.1",content:"reading.en.1"};
    const raw = JSON.stringify(saved);
    localStorage.setItem("pxoracle.tarot.v2",raw);
    return raw;
  });
  await page.reload();
  await page.getByRole("button", {name:"Resume a saved reading"}).click();
  await expect(page.locator(".structured-reading")).toHaveCount(0);
  await page.getByRole("button", {name:"Reinterpret these cards with current content"}).click();
  await expect(page.getByRole("heading", {name:"The whole reading"})).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("pxoracle.tarot.v2"))).toBe(old);
  await page.getByRole("button", {name:"Save reading",exact:true}).click();
  const current = JSON.parse((await page.evaluate(() => localStorage.getItem("pxoracle.tarot.v2")))!);
  expect(current.draw).toEqual(JSON.parse(old).draw);
  expect(current.readingVersions.content).toBe("reading.en.1.1");
  await page.screenshot({path:testInfo.outputPath("release-two-reading.png"),fullPage:true});
});
