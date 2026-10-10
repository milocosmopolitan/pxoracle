import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  timeout: 60000,
  use: { baseURL: "http://127.0.0.1:4173", trace: "retain-on-failure", screenshot:"only-on-failure" },
  webServer: {
    command: "python3 -m http.server 4173 --directory apps/web/out",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  reporter: [["list"], ["html", { open: "never" }]],
});
