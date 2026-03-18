import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL: "http://127.0.0.1:4000",
    trace: "on-first-retry"
  },
  webServer: {
    command: "npm run seed && npm run build && npm run start",
    url: "http://127.0.0.1:4000/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000
  }
});
