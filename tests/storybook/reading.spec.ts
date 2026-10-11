import { test, expect } from "@playwright/test";

test("free-reading stories use production panels and frozen native fixtures without WASM", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  for (const name of [
    "representative",
    "all-reversed",
    "weak-relationship",
    "complement",
    "repeated-theme",
    "mobile",
    "keyboard",
    "all-twelve-perspectives",
    "error-and-retry",
    "legacy-session",
    "unsupported-version",
  ]) {
    await page.goto(
      `/iframe.html?id=pxoracle-free-reading--${name}&viewMode=story`,
    );
    if (name === "error-and-retry")
      await page.getByRole("button", { name: "Retry reflection" }).click();
    if (name === "legacy-session")
      await page.getByRole("button", { name: "Use this perspective" }).click();
    if (name === "unsupported-version")
      await page
        .getByRole("button", {
          name: "Reinterpret these cards with current content",
        })
        .click();
    await expect(
      page.getByRole("heading", { name: "The whole reading" }),
    ).toBeVisible();
    await expect(page.locator(".reading-card")).toHaveCount(3);
    if (name === "all-reversed")
      await expect(
        page.locator(".reading-card small").filter({ hasText: "reversed" }),
      ).toHaveCount(3);
    if (name === "weak-relationship")
      await expect(
        page.getByText("No strong relationship rule connected these cards.", {
          exact: false,
        }),
      ).toBeVisible();
    if (name === "keyboard") {
      const third = page.locator(".reading-card button").nth(2);
      await third.focus();
      await page.keyboard.press("Enter");
      await expect(third).toHaveAttribute("aria-pressed", "true");
    }
  }
  expect(requests.some((url) => url.includes("/engines/"))).toBe(false);
});
