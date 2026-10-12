import type { Locator, Page } from "@playwright/test";

/** A header link; phones collapse the links into a hamburger, so open it first when it is closed. */
export async function navLink(page: Page, name: "The room" | "Tarot" | "Astrology"): Promise<Locator> {
  const toggle = page.getByRole("button", { name: "Open menu" });
  if (await toggle.isVisible()) await toggle.click();
  return page.getByRole("link", { name, exact: true });
}
