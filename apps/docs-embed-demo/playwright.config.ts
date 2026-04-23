import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright visual regression harness (spec §22.4).
 * Baselines are checked in under `tests/visual/*.spec.ts-snapshots/`.
 * Regenerate with `pnpm visual:update` after an intentional visual change.
 */
export default defineConfig({
  testDir: "./tests/visual",
  use: {
    baseURL: "http://localhost:5173",
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:5173",
    timeout: 30_000,
    reuseExistingServer: !process.env.CI,
  },
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
