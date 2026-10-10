import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
 testDir:"tests/storybook", timeout:60000, workers:1,
 use:{...devices["Desktop Chrome"],baseURL:"http://127.0.0.1:6006",reducedMotion:"reduce",trace:"retain-on-failure"},
 webServer:{command:"python3 -m http.server 6006 --directory apps/web/storybook-static",url:"http://127.0.0.1:6006"},
 outputDir:"test-results/storybook",reporter:[["list"]],
});
