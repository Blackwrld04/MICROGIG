import { defineConfig, devices } from "@playwright/test";

/** E2E + accessibility — PRD Appendix D (Chromium, Firefox, Mobile Safari emulation). */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
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
