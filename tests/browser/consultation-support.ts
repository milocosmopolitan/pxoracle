import { expect, type Page } from "@playwright/test";

/** The oracle-led astrology consultation: every ordinary entry begins at the table hub. */
export async function openConsultation(page: Page) {
  await page.goto("/astrology/");
  // The static hub is visible before hydration; its controls enable once React owns them.
  await expect(page.getByRole("button", { name: "Natal Chart" })).toBeEnabled({ timeout: 60000 });
  await expect(page.locator(".natal-layout")).toHaveAttribute("data-presentation", "table");
}
export const layout = (page: Page) => page.locator(".natal-layout");
export const oracle = (page: Page) => page.locator(".oracle-bubble");

export async function chooseNatal(page: Page) {
  await page.getByRole("button", { name: "Natal Chart" }).click();
  await expect(layout(page)).toHaveAttribute("data-stage", "greeting");
}
export async function beginNewChart(page: Page) {
  await chooseNatal(page);
  await oracle(page).getByRole("button", { name: "Begin a new chart" }).click();
  await expect(layout(page)).toHaveAttribute("data-presentation", "globe");
}
/** Country list → city list → explicit confirmation. Confirmation returns to the table. */
export async function confirmCity(page: Page, country: string, query: string, pattern: RegExp) {
  await page.getByLabel("Birth country").selectOption(country);
  await page.getByLabel("Birth city", { exact: true }).fill(query);
  await page.getByRole("button", { name: pattern }).first().click();
  await expect(page.locator(".place-confirmation")).toBeVisible();
  await page.getByRole("button", { name: "Confirm birthplace" }).click();
  await expect(layout(page)).toHaveAttribute("data-presentation", "table");
  await expect(layout(page)).toHaveAttribute("data-stage", "details");
}
export async function confirmManual(page: Page, zone: string, latitude: string, longitude: string, label?: string) {
  await page.getByRole("button", { name: "Enter or adjust coordinates" }).click();
  if (label) await page.getByLabel("Birthplace label (optional)").fill(label);
  await page.getByLabel("Birthplace time zone").fill(zone);
  await page.getByLabel("Latitude", { exact: true }).fill(latitude);
  await page.getByLabel("Longitude", { exact: true }).fill(longitude);
  await page.getByRole("button", { name: "Confirm birthplace" }).click();
  await expect(layout(page)).toHaveAttribute("data-stage", "details");
}
export async function enterDetails(page: Page, date: string, time: string | null, accuracy: "exact" | "approximate" | "unknown" = time === null ? "unknown" : "exact") {
  await page.getByLabel("Birth date", { exact: true }).fill(date);
  await page.getByLabel("Time accuracy").selectOption(accuracy);
  if (time !== null) await page.getByLabel("Local birth time").fill(time);
  await page.getByRole("button", { name: "Review the details" }).click();
  await expect(layout(page)).toHaveAttribute("data-stage", "review");
}
export async function calculate(page: Page) {
  await page.getByRole("button", { name: "Calculate and enter the crystal" }).click();
  await expect(page.getByRole("heading", { name: "Your celestial map" })).toBeVisible({ timeout: 60000 });
  await expect(layout(page)).toHaveAttribute("data-presentation", "crystal");
}
/** The complete new-chart path with synthetic Seoul input. */
export async function seoulChart(page: Page, date = "2000-01-01", time: string | null = "12:00") {
  await openConsultation(page);
  await beginNewChart(page);
  await confirmCity(page, "KR", "Seoul", /Seoul.*Seoul.*South Korea/);
  await enterDetails(page, date, time);
  await calculate(page);
}
export async function openSaved(page: Page) {
  if ((await layout(page).getAttribute("data-stage")) !== "greeting") await chooseNatal(page);
  await oracle(page).getByRole("button", { name: "Open saved chart" }).click();
  await expect(layout(page)).toHaveAttribute("data-presentation", "crystal", { timeout: 60000 });
}
