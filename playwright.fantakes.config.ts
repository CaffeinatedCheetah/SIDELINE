import { defineConfig, devices } from "@playwright/test";

const nodeBin = process.execPath;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `${nodeBin} ./node_modules/.bin/next dev --hostname 127.0.0.1 --port 3000`,
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      SPORTS_DATA_FIXTURE_PATH:
        process.env.SPORTS_DATA_FIXTURE_PATH ??
        "tests/fixtures/sports/contests.json",
    },
  },
});
