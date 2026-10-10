import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
 testDir:"tests/storybook", timeout:120000, workers:1,
 use:{...devices["Desktop Chrome"],baseURL:"http://127.0.0.1:6006",reducedMotion:"reduce",trace:"retain-on-failure"},
 webServer:[{command:"python3 -m http.server 6006 --directory apps/web/storybook-static",url:"http://127.0.0.1:6006"},{command:"cd apps/web && ../../node_modules/.bin/storybook dev -p 6007 --ci --no-open",url:"http://127.0.0.1:6007",timeout:120000}],
 outputDir:"test-results/storybook",reporter:[["list"]],
});
