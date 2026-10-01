import { defineConfig, devices } from "@playwright/test";

/** E2E + accessibility — PRD Appendix D (Chromium, Firefox, Mobile Safari emulation). */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // First requests compile pages on demand in dev mode, which can take well over 30 s.
  timeout: 120_000,
  workers: 2,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 13"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/gigs",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
