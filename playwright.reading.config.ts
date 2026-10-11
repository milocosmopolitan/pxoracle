import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  testMatch: [
    "reading.spec.ts",
    "tarot-fallback.spec.ts",
    "tarot-table.spec.ts",
  ],
  timeout: 120000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4180",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command:
      "python3 -m http.server 4180 --bind 127.0.0.1 --directory apps/web/out",
    url: "http://127.0.0.1:4180",
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "reading-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "reading-mobile", use: { ...devices["Pixel 7"] } },
  ],
  outputDir: "test-results/reading",
  reporter: [["list"]],
});
