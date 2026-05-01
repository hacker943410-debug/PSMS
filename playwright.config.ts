import { defineConfig } from "@playwright/test";

const WEB_BASE_URL = process.env.PSMS_WEB_URL ?? "http://127.0.0.1:5273";

export default defineConfig({
  testDir: "./test/e2e",
  testMatch: ["**/*.spec.ts"],
  globalSetup: "./test/e2e/global-setup.ts",
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  outputDir: "test-results/playwright",
  use: {
    baseURL: WEB_BASE_URL,
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium-1586",
      use: {
        browserName: "chromium",
        viewport: { width: 1586, height: 992 },
      },
    },
    {
      name: "chromium-1440",
      use: {
        browserName: "chromium",
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "chromium-1280",
      use: {
        browserName: "chromium",
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
});
