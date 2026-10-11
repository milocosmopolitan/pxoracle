import { defineConfig, devices } from "@playwright/test";
// Use Chromium's explicit software GL driver on GPU-less CI, including compositing.
const softwareGL = process.env.CI
  ? { args: ["--use-gl=angle", "--use-angle=swiftshader"] }
  : undefined;
const port = Number(process.env.PXORACLE_TEST_PORT ?? 4173);
export default defineConfig({
  testDir: "tests/browser",
  timeout: 180000,
  workers: 1,
  expect: { timeout: 15000 },
  use: {
    reducedMotion: "reduce",
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `python3 -m http.server ${port} --directory apps/web/out`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: "chrome",
      use: { ...devices["Desktop Chrome"], channel: "chrome", deviceScaleFactor: process.env.CI ? 0.5 : 1, launchOptions: softwareGL },
    },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    {
      name: "mobile-chromium-emulation",
      use: { ...devices["Pixel 7"], reducedMotion: "reduce", deviceScaleFactor: process.env.CI ? 0.5 : devices["Pixel 7"].deviceScaleFactor, launchOptions: softwareGL },
    },
  ],
  reporter: [["list"], ["html", { open: "never" }]],
});
