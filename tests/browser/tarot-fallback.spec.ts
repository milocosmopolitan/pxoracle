import { test, expect } from "@playwright/test";
import { settleTarot } from "./tarot-support";

test("explicit DOM progression works without WebGL and keeps questions private", async ({ page }) => {
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind: string, ...args: any[]) {
      if (kind.startsWith("webgl")) return null;
      return (get as any).call(this, kind, ...args);
    } as any;
  });
  const question = "private-question-test-marker";
  const requests: string[] = [];
  page.on("request", r => requests.push(r.url() + (r.postData() ?? "")));
  await page.goto("/tarot/");
  await page.getByRole("textbox").fill(question);
  await page.getByLabel("Your spread").selectOption("1");
  await page.getByRole("button", { name: "Shuffle the deck" }).click();
  await settleTarot(page, page.getByRole("button", { name: "Choose slot 1", exact: true }));
  await page.getByRole("button", { name: "Choose slot 1", exact: true }).click();
  await settleTarot(page, page.getByRole("heading", { name: "Let the images settle." }));
  await page.getByRole("button", { name: "Save reading", exact: true }).click();
  const saved = await page.evaluate(() => localStorage.getItem("pxoracle.tarot.v2"));
  expect(saved).not.toContain(question);
  expect(requests.join(" ")).not.toContain(question);
  expect(JSON.parse(saved!).draw.selections[0].revealed).toBe(true);
  await page.getByRole("button", { name: "New reading" }).click();
  await expect(page.getByRole("textbox")).toHaveValue("");
});
