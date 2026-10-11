import { test, expect, type Page } from "@playwright/test";
import fixtures from "../fixtures/natal.json";
import { graphicsAvailable } from "./tarot-support";
async function enterCity(page: Page, country = "KR", city = "서울") {
  await page.goto("/astrology/");
  await page.getByLabel("Birth country").selectOption(country);
  await page.getByLabel("Birth city", { exact: true }).fill(city);
  await page.getByRole("button", { name: /Seoul.*Seoul.*South Korea/ }).click();
  await page.getByLabel("Birth date", { exact: true }).fill("2000-01-01");
  await page.getByLabel("Local birth time").fill("12:00");
}
async function manual(page: Page, date: string, time: string, zone: string) {
  await page.goto("/astrology/");
  await page
    .getByRole("button", { name: "Enter or adjust coordinates" })
    .click();
  await page.getByLabel("Birth date", { exact: true }).fill(date);
  await page.getByLabel("Local birth time").fill(time);
  await page.getByLabel("Birthplace time zone").fill(zone);
  await page.getByLabel("Latitude", { exact: true }).fill("40.7");
  await page.getByLabel("Longitude", { exact: true }).fill("-74");
}
test("city to crystal, selection, full report, explicit save and validated restore", async ({
  page,
}) => {
  const requests: string[] = [],
    errors: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const ops: string[] = [];
    (window as any).__natalOps = ops;
    const original = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (message: any, transfer: any) {
      if (message?.payload?.op) ops.push(message.payload.op);
      return original.call(this, message, transfer);
    };
  });
  await enterCity(page);
  expect(requests.some((url) => /\/engines\/.*\.wasm/.test(url))).toBe(false);
  expect(requests.some((url) => /\/content\/atlas\/US\./.test(url))).toBe(
    false,
  );
  await page.getByRole("button", { name: "Enter the crystal" }).click();
  await expect(
    page.getByRole("heading", { name: "A first look at your map" }),
  ).toBeVisible();
  await expect(
    page.getByText("Asia/Seoul · UTC+09:00", { exact: false }),
  ).toBeVisible();
  expect(requests.some((url) => url.includes("/tarot/engine"))).toBe(false);
  await page.getByRole("button", { name: /^Moon / }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("region", { name: "Selected chart detail" }),
  ).toContainText("Moon");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Whole chart", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Read full HTML report" }).click();
  await expect(
    page.getByRole("article", { name: "Full natal report" }),
  ).toContainText("Every supported placement");
  await expect(
    page.getByRole("article", { name: "Full natal report" }),
  ).toContainText("Terms and limits");
  await page.getByRole("button", { name: "Save on this device" }).click();
  const saved = await page.evaluate(() =>
    localStorage.getItem("pxoracle.natal-report.v1"),
  );
  expect(saved).toBeTruthy();
  expect(new URL(page.url()).search).toBe("");
  await page.reload();
  await page.getByRole("button", { name: "Open saved chart" }).click();
  await expect(
    page.getByRole("heading", { name: "A first look at your map" }),
  ).toBeVisible();
  expect(await page.evaluate(() => (window as any).__natalOps)).toEqual([
    "restoreNatal",
    "natalInterpret",
  ]);
  expect(
    await page.evaluate(() => localStorage.getItem("pxoracle.natal-report.v1")),
  ).toBe(saved);
  await page.getByRole("button", { name: "Delete saved chart" }).click();
  expect(
    await page.evaluate(() => localStorage.getItem("pxoracle.natal-report.v1")),
  ).toBeNull();
  expect(errors).toEqual([]);
  await page.screenshot({
    path: test.info().outputPath("natal-restored.png"),
    scale: "css",
  });
});
test("DST fold is progressive and a skipped local time is never silently moved", async ({
  page,
}) => {
  await manual(page, "2021-11-07", "01:30", "America/New_York");
  await expect(
    page.getByLabel("This clock time occurred twice.", { exact: false }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Enter the crystal" }).click();
  await page
    .getByLabel("This clock time occurred twice.", { exact: false })
    .selectOption("later");
  await page.getByRole("button", { name: "Enter the crystal" }).click();
  await expect(
    page.getByText("America/New_York · UTC−05:00", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit details" }).click();
  await page.getByLabel("Birth date", { exact: true }).fill("2021-03-14");
  await page.getByLabel("Local birth time").fill("02:30");
  await page.getByRole("button", { name: "Enter the crystal" }).click();
  await expect(page.locator(".natal-panel").getByRole("alert")).toContainText(
    "clock skipped this local time",
  );
  await expect(page.getByLabel("Local birth time")).toHaveValue("02:30");
});
test("content failure retries the same calculated chart and caches symbolic packs", async ({
  page,
}) => {
  let fail = true;
  const symbolic: string[] = [];
  page.on("request", (r) => {
    if (/\/content\/natal\/(semantics|rules)/.test(r.url()))
      symbolic.push(r.url());
  });
  await page.route("**/content/natal/en.1.json", (route) =>
    fail ? route.abort() : route.continue(),
  );
  await enterCity(page);
  await page.getByRole("button", { name: "Enter the crystal" }).click();
  await expect(page.locator(".natal-panel").getByRole("alert")).toContainText(
    "calculated chart has been kept",
  );
  const before = await page.locator(".planets").innerText();
  fail = false;
  await page
    .getByRole("button", { name: "Retry interpretation for this chart" })
    .click();
  await expect(
    page.getByRole("heading", { name: "A first look at your map" }),
  ).toBeVisible();
  expect(await page.locator(".planets").innerText()).toBe(before);
  expect(symbolic.filter((x) => x.includes("semantics")).length).toBe(1);
  expect(symbolic.filter((x) => x.includes("rules")).length).toBe(1);
});
test("legacy restore requires explicit interpretation and leaves the original save intact", async ({
  page,
}) => {
  const f = fixtures[0],
    legacy = JSON.stringify({
      schemaVersion: 1,
      value: { input: f.input, chart: f.chart },
    });
  await page.goto("/astrology/");
  await page.evaluate(
    (value) => localStorage.setItem("pxoracle.astrology-chart.v1", value),
    legacy,
  );
  await page.getByRole("button", { name: "Open saved chart" }).click();
  await expect(
    page.getByRole("button", { name: "Generate interpretation", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "A first look at your map" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Generate interpretation", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A first look at your map" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("pxoracle.astrology-chart.v1"),
    ),
  ).toBe(legacy);
  expect(
    await page.evaluate(() => localStorage.getItem("pxoracle.natal-report.v1")),
  ).toBeNull();
});
test("duplicate city keyboard choice, atlas retry and unknown-time disclosure", async ({
  page,
}) => {
  let fail = true;
  await page.route("**/content/atlas/US.*.json", (route) =>
    fail ? route.abort() : route.continue(),
  );
  await page.goto("/astrology/");
  await page.getByLabel("Birth country").selectOption("US");
  await expect(page.locator(".natal-panel").getByRole("alert")).toContainText(
    "city data could not load",
  );
  fail = false;
  await page.getByRole("button", { name: "Retry city data" }).click();
  await page.getByLabel("Birth city", { exact: true }).fill("Springfield");
  await expect(
    page.getByRole("button", { name: /Springfield.*Illinois/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /^Springfield Massachusetts/ })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".place-confirmation")).toContainText(
    "Massachusetts",
  );
  await page.getByLabel("Time accuracy").selectOption("unknown");
  await expect(page.getByLabel("Local birth time")).toHaveCount(0);
  await expect(
    page.getByText("Only midpoint positions", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("Birth date", { exact: true }).fill("2000-01-02");
  await page.getByRole("button", { name: "Enter the crystal" }).click();
  await expect(
    page.getByText("Birth time is uncertain.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "A first look at your map" }),
  ).toBeVisible();
  await expect(
    page.getByText("Explore planetary relationships", { exact: false }),
  ).toHaveCount(0);
});
test("route abandonment ignores late content and preserves a single owned canvas", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/content/natal/en.1.json", async (route) => {
    await gate;
    await route.continue().catch(() => {});
  });
  try {
    await enterCity(page);
    await page.getByRole("button", { name: "Enter the crystal" }).click();
    await expect(
      page.getByText("Composing your local interpretation", { exact: false }),
    ).toBeVisible();
    await page.getByRole("link", { name: "The room", exact: true }).click();
  } finally {
    release();
  }
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Some answers",
  );
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "A first look at your map" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Astrology", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A first look at your map" }),
  ).toBeVisible();
});

test("inconsistent saved plans require explicit regeneration without replacing storage", async ({
  page,
}) => {
  const f = fixtures[0],
    plan = structuredClone(f.plan);
  plan.coreIds = [];
  const saved = JSON.stringify({
    schemaVersion: 1,
    input: f.input,
    chart: f.chart,
    plan,
    versions: f.plan.versions,
    place: null,
    savedAt: "2026-10-11T00:00:00Z",
  });
  await page.goto("/astrology/");
  await page.evaluate(
    (value) => localStorage.setItem("pxoracle.natal-report.v1", value),
    saved,
  );
  await page.getByRole("button", { name: "Open saved chart" }).click();
  await expect(page.locator(".natal-panel").getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "A first look at your map" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "Generate a new interpretation with current content",
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "A first look at your map" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("pxoracle.natal-report.v1")),
  ).toBe(saved);
});

test("crystal raycasting selects bodies and relationships; drag and empty background clear safely", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterCity(page);
  test.skip(
    !(await graphicsAvailable(page)),
    "This runner has no WebGL; DOM coverage is separate.",
  );
  await page.getByRole("button", { name: "Enter the crystal" }).click();
  await expect(
    page.getByRole("heading", { name: "A first look at your map" }),
  ).toBeVisible();
  await expect(page.locator(".scene-status")).toHaveCount(0);
  await expect(page.locator(".natal-stage")).toHaveAttribute(
    "data-settled",
    "true",
  );
  await expect(page.locator(".door-entrance")).toHaveCount(0);
  // Coordinates are checked against the committed 390×844 Seoul fixture capture.
  await page.mouse.move(72, 278);
  await page.mouse.down();
  await page.mouse.move(110, 285, { steps: 5 });
  await page.mouse.up();
  await expect(
    page.getByRole("button", { name: "Whole chart", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.mouse.click(72, 278);
  await expect(
    page.getByRole("region", { name: "Selected chart detail" }),
  ).toContainText("Moon in Scorpio");
  await page.keyboard.press("Escape");
  await expect(page.locator(".natal-stage")).toHaveAttribute(
    "data-settled",
    "true",
  );
  await page.mouse.click(200, 325);
  await expect(
    page.getByRole("region", { name: "Selected chart detail" }),
  ).toContainText("Moon & Uranus");
  await expect(page.locator(".natal-stage")).toHaveAttribute(
    "data-settled",
    "true",
  );
  await page.mouse.click(360, 415);
  await expect(
    page.getByRole("button", { name: "Whole chart", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("worldwide country shards stay lazy and a quarter-hour-zone chart restores", async ({page}) => {
 const atlasRequests:string[]=[];
 page.on("request",r=>{if(r.url().includes("/content/atlas/"))atlasRequests.push(r.url());});
 await page.goto("/astrology/");
 await expect(page.locator(".door-entrance")).toHaveCount(0,{timeout:20000});
 await expect(page.getByLabel("Birth country").locator("option")).toHaveCount(245);
 expect(atlasRequests).toEqual([]);
 for(const [country,query,zone] of [["JP","東京","Asia/Tokyo"],["FR","Paris","Europe/Paris"],["BR","São Paulo","America/Sao_Paulo"],["EG","القاهرة","Africa/Cairo"],["AU","Sydney","Australia/Sydney"],["NP","Kathmandu","Asia/Kathmandu"]]) {
  await page.getByLabel("Birth country").selectOption(country);
  await page.getByLabel("Birth city",{exact:true}).fill(query);
  await page.locator(".city-results button").first().click();
  await expect(page.locator(".place-confirmation")).toContainText(zone);
 }
 const shards=atlasRequests.filter(u=>!/manifest\./.test(u)).map(u=>u.split("/").at(-1)!.split(".")[0]);
 expect(shards.sort()).toEqual(["AU","BR","EG","FR","JP","NP"]);
 expect(atlasRequests.every(u=>!u.includes("Kathmandu")&&!u.includes("Paris"))).toBe(true);
 await page.getByLabel("Birth date",{exact:true}).fill("2000-01-01");
 await page.getByLabel("Local birth time").fill("12:00");
 await page.getByRole("button",{name:"Enter the crystal"}).click();
 await expect(page.getByRole("heading",{name:"A first look at your map"})).toBeVisible();
 await expect(page.getByText("Asia/Kathmandu · UTC+05:45",{exact:false})).toBeVisible();
 await page.getByRole("button",{name:"Save on this device"}).click();
 const saved=await page.evaluate(()=>localStorage.getItem("pxoracle.natal-report.v1"));
 expect(JSON.parse(saved!).place.country).toBe("NP");
 await page.reload();
 await page.getByRole("button",{name:"Open saved chart"}).click();
 await expect(page.getByRole("heading",{name:"A first look at your map"})).toBeVisible();
 expect(await page.evaluate(()=>localStorage.getItem("pxoracle.natal-report.v1"))).toBe(saved);
 await expect(page.locator(".door-entrance")).toHaveCount(0,{timeout:20000});
 await page.screenshot({path:test.info().outputPath("worldwide-kathmandu-restored.png"),scale:"css"});
});
