import { test, expect, type Page } from "@playwright/test";
import fixtures from "../fixtures/natal.json";
import { graphicsAvailable } from "./tarot-support";
import { beginNewChart, calculate, chooseNatal, confirmCity, enterDetails, layout, openConsultation, openSaved, oracle, seoulChart } from "./consultation-support";

const fixture = fixtures[0];
const savedCurrent = () => JSON.stringify({ schemaVersion: 1, input: fixture.input, chart: fixture.chart, plan: fixture.plan, versions: fixture.plan.versions, place: { source: "atlas", label: "Seoul, Seoul, South Korea", cityId: "1835848", country: "KR", atlasVersion: "test" }, savedAt: "2026-10-11T00:00:00Z" });
async function seed(page: Page, key: string, value: string) {
  await page.goto("/astrology/");
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [key, value]);
}
const engineRequests = (requests: string[]) => requests.filter((url) => /\/engines\//.test(url));
const atlasRequests = (requests: string[]) => requests.filter((url) => /\/content\/atlas\//.test(url));
const contentRequests = (requests: string[]) => requests.filter((url) => /\/content\/natal\//.test(url));

test("direct entry begins at the consultation table with service choices and no eager globe, engine, atlas or content loading", async ({ page }) => {
  const requests: string[] = [], errors: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  page.on("pageerror", (e) => errors.push(e.message));
  await openConsultation(page);
  await expect(page.getByRole("heading", { name: "A sky that began with you." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Horoscopes" })).toBeVisible();
  await expect(page.getByLabel("Birth country")).toHaveCount(0);
  await expect(page.getByLabel("Birth date", { exact: true })).toHaveCount(0);
  await expect(layout(page)).toHaveAttribute("data-globe-phase", "room");
  await expect(oracle(page)).toContainText("Shall we look at the sky you were born under");
  await page.waitForTimeout(1500);
  expect(engineRequests(requests)).toEqual([]);
  expect(atlasRequests(requests)).toEqual([]);
  expect(contentRequests(requests)).toEqual([]);
  // Horoscopes is a separate branch with an honest availability notice and a way back.
  await page.getByRole("button", { name: "Horoscopes" }).click();
  await expect(oracle(page)).toContainText("Horoscopes are not ready in this room yet");
  await expect(layout(page)).toHaveAttribute("data-presentation", "table");
  await expect(layout(page)).toHaveAttribute("data-globe-phase", "room");
  await expect(page.getByLabel("Birth country")).toHaveCount(0);
  await page.getByRole("button", { name: "Back to the consultation" }).click();
  await expect(page.getByRole("button", { name: "Natal Chart" })).toBeVisible();
  expect(engineRequests(requests)).toEqual([]);
  expect(atlasRequests(requests)).toEqual([]);
  // Reload also begins at the table.
  await page.reload();
  await expect(page.getByRole("button", { name: "Natal Chart" })).toBeEnabled({ timeout: 60000 });
  await expect(layout(page)).toHaveAttribute("data-presentation", "table");
  expect(errors).toEqual([]);
  expect(new URL(page.url()).search).toBe("");
});

test("new chart: greeting, globe, city selection without zoom, confirmation back to the table before any calculation, review, crystal, return and resume", async ({ page }) => {
  const requests: string[] = [], errors: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  page.on("pageerror", (e) => errors.push(e.message));
  await openConsultation(page);
  await chooseNatal(page);
  await expect(oracle(page)).toContainText("No chart is kept on this device");
  await expect(layout(page)).toHaveAttribute("data-presentation", "table");
  await oracle(page).getByRole("button", { name: "Begin a new chart" }).click();
  await expect(layout(page)).toHaveAttribute("data-presentation", "globe");
  await expect(layout(page)).toHaveAttribute("data-globe-phase", "overview");
  await expect(page.locator(".stage-return")).toBeVisible();
  await page.getByLabel("Birth country").selectOption("KR");
  await expect(layout(page)).toHaveAttribute("data-globe-phase", "country");
  const revisionBefore = await page.locator(".globe-chooser").getAttribute("data-camera-revision");
  await page.getByLabel("Birth city", { exact: true }).fill("Seoul");
  await page.getByRole("button", { name: /Seoul.*Seoul.*South Korea/ }).click();
  await expect(page.locator(".place-confirmation")).toContainText("Asia/Seoul");
  expect(await page.locator(".globe-chooser").getAttribute("data-camera-revision")).toBe(revisionBefore);
  await expect(layout(page)).toHaveAttribute("data-globe-phase", "country");
  expect(engineRequests(requests)).toEqual([]);
  // Confirmation commits the place and returns to the table; no calculation, no engine.
  await page.getByRole("button", { name: "Confirm birthplace" }).click();
  await expect(layout(page)).toHaveAttribute("data-presentation", "table");
  await expect(layout(page)).toHaveAttribute("data-stage", "details");
  await expect(layout(page)).toHaveAttribute("data-globe-phase", "room");
  await expect(oracle(page)).toContainText("Born in Seoul, Seoul, South Korea");
  await expect(page.locator(".place-confirmation")).toContainText("37.566°, 126.9784° · Asia/Seoul");
  expect(engineRequests(requests)).toEqual([]);
  await enterDetails(page, "2000-01-01", "12:00");
  await expect(page.getByRole("heading", { name: "Is this right?" })).toBeVisible();
  await expect(page.locator(".birth-summary")).toContainText("2000-01-01");
  // Editing keeps the entered values; changing the birthplace reopens the globe at the same country.
  await page.getByRole("button", { name: "Edit date and time" }).click();
  await expect(page.getByLabel("Birth date", { exact: true })).toHaveValue("2000-01-01");
  await expect(page.getByLabel("Local birth time")).toHaveValue("12:00");
  await page.getByRole("button", { name: "Change birthplace" }).click();
  await expect(layout(page)).toHaveAttribute("data-globe-phase", "country");
  await expect(page.getByLabel("Birth country")).toHaveValue("KR");
  await page.getByRole("button", { name: "Keep the previous birthplace" }).click();
  await expect(layout(page)).toHaveAttribute("data-stage", "details");
  await expect(page.getByLabel("Birth date", { exact: true })).toHaveValue("2000-01-01");
  await page.getByRole("button", { name: "Review the details" }).click();
  expect(engineRequests(requests)).toEqual([]);
  await calculate(page);
  await expect(page.getByRole("heading", { name: "A first look at your map" })).toBeVisible({ timeout: 60000 });
  await expect(page.getByText("Asia/Seoul · UTC+09:00", { exact: false })).toBeVisible();
  expect(engineRequests(requests).some((url) => url.includes("/astrology/"))).toBe(true);
  const planets = await page.locator(".planets").innerText();
  const storageBefore = await page.evaluate(() => localStorage.getItem("pxoracle.natal-report.v1"));
  expect(storageBefore).toBeNull();
  // Return is presentation navigation: chart, interpretation and inputs stay.
  await page.locator(".stage-return").click();
  await expect(layout(page)).toHaveAttribute("data-presentation", "table");
  await expect(layout(page)).toHaveAttribute("data-globe-phase", "room");
  await expect(page.getByRole("button", { name: "Resume the current chart" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Natal Chart" })).toBeVisible();
  await page.getByRole("button", { name: "Resume the current chart" }).click();
  await expect(layout(page)).toHaveAttribute("data-presentation", "crystal");
  await expect(page.getByRole("heading", { name: "A first look at your map" })).toBeVisible();
  expect(await page.locator(".planets").innerText()).toBe(planets);
  expect(await page.evaluate(() => localStorage.getItem("pxoracle.natal-report.v1"))).toBeNull();
  // Layered Escape: detail → whole chart → table.
  await page.getByRole("button", { name: /^Moon / }).click();
  await expect(page.getByRole("region", { name: "Selected chart detail" })).toContainText("Moon");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Whole chart", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(layout(page)).toHaveAttribute("data-presentation", "crystal");
  await page.keyboard.press("Escape");
  await expect(layout(page)).toHaveAttribute("data-presentation", "table");
  // Adjusting details from the chart reviews the recorded input at the table without the globe.
  await page.getByRole("button", { name: "Resume the current chart" }).click();
  await page.getByRole("button", { name: "Adjust birth details" }).click();
  await expect(layout(page)).toHaveAttribute("data-stage", "details");
  await expect(layout(page)).toHaveAttribute("data-globe-phase", "room");
  await expect(page.getByLabel("Birth date", { exact: true })).toHaveValue("2000-01-01");
  expect(errors).toEqual([]);
  expect(requests.some((url) => /Seoul|37\.56|126\.97|2000-01-01/.test(url))).toBe(false);
  expect(new URL(page.url()).search).toBe("");
});

test("a valid saved chart opens from the greeting without the globe and leaves storage untouched", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await seed(page, "pxoracle.natal-report.v1", savedCurrent());
  await page.reload();
  await expect(page.getByRole("button", { name: "Natal Chart" })).toBeEnabled({ timeout: 60000 });
  await expect(layout(page)).toHaveAttribute("data-presentation", "table");
  expect(engineRequests(requests)).toEqual([]);
  const phases: string[] = [];
  await page.exposeFunction("recordPhase", (phase: string) => phases.push(phase));
  await page.evaluate(() => {
    const target = document.querySelector(".natal-layout")!;
    new MutationObserver(() => (window as any).recordPhase(target.getAttribute("data-globe-phase"))).observe(target, { attributes: true, attributeFilter: ["data-globe-phase"] });
  });
  await chooseNatal(page);
  await expect(oracle(page)).toContainText("I have a chart you saved here from Seoul, Seoul, South Korea");
  await expect(oracle(page).getByRole("button", { name: "Open saved chart" })).toBeVisible();
  await expect(oracle(page).getByRole("button", { name: "Review saved details" })).toBeVisible();
  await expect(oracle(page).getByRole("button", { name: "Begin a new chart" })).toBeVisible();
  expect(engineRequests(requests)).toEqual([]);
  await openSaved(page);
  await expect(page.getByRole("heading", { name: "A first look at your map" })).toBeVisible({ timeout: 60000 });
  expect(phases.filter((p) => p === "overview" || p === "country" || p === "region")).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem("pxoracle.natal-report.v1"))).toBe(savedCurrent());
  await page.locator(".stage-return").click();
  await expect(layout(page)).toHaveAttribute("data-presentation", "table");
  await expect(page.getByRole("button", { name: "Resume the current chart" })).toBeVisible();
  // Reviewing saved details goes straight to the summary at the table.
  await page.getByRole("button", { name: "Natal Chart" }).click({ timeout: 30000 });
  await oracle(page).getByRole("button", { name: "Review saved details" }).click();
  await expect(layout(page)).toHaveAttribute("data-stage", "review");
  await expect(page.locator(".birth-summary")).toContainText("Seoul, Seoul, South Korea");
  await expect(layout(page)).toHaveAttribute("data-globe-phase", "room");
  expect(await page.evaluate(() => localStorage.getItem("pxoracle.natal-report.v1"))).toBe(savedCurrent());
  expect(atlasRequests(requests)).toEqual([]);
});

test("legacy, input-only, unsupported, corrupt and inaccessible saves are greeted honestly and never rewritten", async ({ page }) => {
  const legacy = JSON.stringify({ schemaVersion: 1, value: { input: fixture.input, chart: fixture.chart } });
  await seed(page, "pxoracle.astrology-chart.v1", legacy);
  await page.reload();
  await chooseNatal(page);
  await expect(oracle(page)).toContainText("older saved chart");
  await expect(oracle(page)).toContainText("no written report yet");
  await openSaved(page);
  await expect(page.getByRole("button", { name: "Generate interpretation", exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("pxoracle.astrology-chart.v1"))).toBe(legacy);
  expect(await page.evaluate(() => localStorage.getItem("pxoracle.natal-report.v1"))).toBeNull();
  await page.evaluate(() => localStorage.clear());

  const inputOnly = JSON.stringify({ schemaVersion: 1, value: fixture.input });
  await seed(page, "pxoracle.astrology.v1", inputOnly);
  await page.reload();
  await chooseNatal(page);
  await expect(oracle(page)).toContainText("only your saved birth details");
  await expect(oracle(page).getByRole("button", { name: "Open saved chart" })).toHaveCount(0);
  await oracle(page).getByRole("button", { name: "Review saved details" }).click();
  await expect(layout(page)).toHaveAttribute("data-stage", "review");
  await expect(layout(page)).toHaveAttribute("data-globe-phase", "room");
  expect(await page.evaluate(() => localStorage.getItem("pxoracle.astrology.v1"))).toBe(inputOnly);
  await page.evaluate(() => localStorage.clear());

  const unsupported = JSON.stringify({ schemaVersion: 1, input: fixture.input, chart: fixture.chart, plan: null, versions: { schema: 1 }, place: null, savedAt: "x" });
  await seed(page, "pxoracle.natal-report.v1", unsupported);
  await page.reload();
  await chooseNatal(page);
  await expect(oracle(page)).toContainText("versions this room no longer supports");
  await openSaved(page);
  await expect(page.getByRole("button", { name: "Generate interpretation", exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("pxoracle.natal-report.v1"))).toBe(unsupported);
  await page.evaluate(() => localStorage.clear());

  await seed(page, "pxoracle.natal-report.v1", "{not json");
  await page.reload();
  await chooseNatal(page);
  await expect(oracle(page)).toContainText("cannot read it");
  await expect(oracle(page).getByRole("button", { name: "Open saved chart" })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("pxoracle.natal-report.v1"))).toBe("{not json");
  await oracle(page).getByRole("button", { name: "Delete the unreadable save" }).click();
  await expect(oracle(page)).toContainText("No chart is kept on this device");
  expect(await page.evaluate(() => localStorage.getItem("pxoracle.natal-report.v1"))).toBeNull();

  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { get() { throw new Error("SecurityError"); } });
  });
  await openConsultation(page);
  await chooseNatal(page);
  await expect(oracle(page)).toContainText("will not let me look at saved charts");
  await expect(oracle(page).getByRole("button", { name: "Begin a new chart" })).toBeVisible();
});

test("a late calculation cannot pull a reader who returned to the table into the crystal", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/engines/astrology/**", async (route) => { await gate; await route.continue().catch(() => {}); });
  await openConsultation(page);
  await beginNewChart(page);
  await confirmCity(page, "KR", "Seoul", /Seoul.*Seoul.*South Korea/);
  await enterDetails(page, "2000-01-01", "12:00");
  await page.getByRole("button", { name: "Calculate and enter the crystal" }).click();
  await expect(page.getByRole("button", { name: "Calculating…" })).toBeVisible();
  await page.getByRole("button", { name: "Back to the consultation" }).click();
  await expect(layout(page)).toHaveAttribute("data-stage", "hub");
  release();
  await expect(page.getByRole("button", { name: "Resume the current chart" })).toBeVisible({ timeout: 60000 });
  await page.waitForTimeout(500);
  await expect(layout(page)).toHaveAttribute("data-presentation", "table");
  await page.getByRole("button", { name: "Resume the current chart" }).click();
  await expect(page.getByRole("heading", { name: "A first look at your map" })).toBeVisible({ timeout: 60000 });
});

test("the globe can be left before a country, after a city and with Escape; the confirmed place survives", async ({ page }) => {
  await openConsultation(page);
  await beginNewChart(page);
  await page.locator(".stage-return").click();
  await expect(layout(page)).toHaveAttribute("data-stage", "greeting");
  await oracle(page).getByRole("button", { name: "Begin a new chart" }).click();
  await confirmCity(page, "KR", "Seoul", /Seoul.*Seoul.*South Korea/);
  await page.getByRole("button", { name: "Change birthplace" }).click();
  await page.getByLabel("Birth country").selectOption("SG");
  await expect(page.locator(".place-confirmation")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(layout(page)).toHaveAttribute("data-presentation", "table");
  await expect(layout(page)).toHaveAttribute("data-stage", "details");
  await expect(page.locator(".place-confirmation")).toContainText("Seoul, Seoul, South Korea");
  await expect(page.locator(".oracle-bubble")).toBeFocused();
});

test("mobile viewport keeps the dialogue readable and the flow usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openConsultation(page);
  await expect(oracle(page)).toBeVisible();
  const bubble = await oracle(page).boundingBox();
  const stage = await page.locator(".natal-stage").boundingBox();
  // The bubble is a sheet at the bottom of the stage and never covers the caption or the oracle framing above it.
  const caption = await page.locator(".natal-scene-caption").boundingBox();
  expect(bubble!.y).toBeGreaterThanOrEqual(caption!.y + caption!.height);
  expect(bubble!.y + bubble!.height).toBeLessThanOrEqual(stage!.y + stage!.height + 1);
  await chooseNatal(page);
  await oracle(page).getByRole("button", { name: "Begin a new chart" }).click();
  await expect(layout(page)).toHaveAttribute("data-presentation", "globe");
  await page.locator(".stage-return").click();
  await expect(layout(page)).toHaveAttribute("data-presentation", "table");
  await page.screenshot({ path: test.info().outputPath("consultation-mobile.png"), scale: "css" });
});

test("entering without WebGL keeps every consultation control usable", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (type.startsWith("webgl")) return null;
      return Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
  await openConsultation(page);
  await expect(page.getByText("Your browser cannot start WebGL. All reading controls remain available.")).toBeVisible();
  await beginNewChart(page);
  await confirmCity(page, "SG", "Singapore", /Singapore.*Asia\/Singapore/);
  await expect(page.locator(".place-confirmation")).toContainText("Asia/Singapore");
});

test("the landing globe is an explicit shortcut that keeps the current chart and birth details", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chrome", "Fixed desktop Chrome pointer target.");
  await page.setViewportSize({ width: 1440, height: 900 });
  await seoulChart(page);
  test.skip(!(await graphicsAvailable(page)), "Actual globe mouse selection requires WebGL.");
  await page.getByRole("link", { name: /Back to the room/ }).click();
  await expect(page).toHaveURL(/^https?:\/\/[^/]+\/$/);
  await expect(page.getByText("Sit with the oracle for your natal chart")).toBeVisible();
  await expect(page.locator('.scene-host[data-route="landing"]')).toHaveAttribute("data-ready", "true");
  await page.waitForFunction(() => document.querySelector("canvas")?.style.opacity === "1");
  await expect.poll(() => page.evaluate(() => document.elementFromPoint(671, 431)?.tagName)).toBe("CANVAS");
  await page.mouse.click(671, 431);
  await expect(page).toHaveURL(/\/astrology\/$/);
  await expect(layout(page)).toHaveAttribute("data-presentation", "globe");
  await page.getByRole("button", { name: "Keep the previous birthplace" }).click();
  await expect(layout(page)).toHaveAttribute("data-stage", "details");
  await expect(page.getByLabel("Birth date", { exact: true })).toHaveValue("2000-01-01");
  await page.getByRole("button", { name: "Back to the consultation" }).click();
  await expect(page.getByRole("button", { name: "Resume the current chart" })).toBeVisible();
});
