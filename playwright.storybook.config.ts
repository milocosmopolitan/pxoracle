import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/storybook",
  timeout: 120000,
  workers: 1,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:6106",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command:
        "python3 -m http.server 6106 --directory apps/web/storybook-static",
      url: "http://127.0.0.1:6106",
      reuseExistingServer: false,
    },
    {
      command:
        "cd apps/web && CHOKIDAR_USEPOLLING=true CHOKIDAR_INTERVAL=100 ../../node_modules/.bin/storybook dev -p 6107 --ci --no-open",
      url: "http://127.0.0.1:6107",
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
  outputDir: "test-results/storybook",
  reporter: [["list"]],
});
