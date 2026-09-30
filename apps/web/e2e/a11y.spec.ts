import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

type Who = "client" | "freelancer" | "admin";
const DEMO_EMAIL: Record<Who, string> = {
  client: "alice@example.com",
  freelancer: "alex@example.com",
  admin: "admin@microgig.dev",
};

/** Signs in through the demo auth API; the session cookie lands in the page's context. */
async function loginAs(page: Page, who: Who) {
  const res = await page.request.post("/api/v1/auth/login", { data: { email: DEMO_EMAIL[who], password: "demo" } });
  expect(res.ok()).toBeTruthy();
}

async function expectNoA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

// WCAG 2.1 AA — PRD §17. Every route, as the account type that can see it.
const PAGES: Record<Who | "guest", string[]> = {
  guest: [
    "/",
    "/gigs",
    "/gigs?category=video-animation",
    "/categories/programming-tech",
    "/gigs/i-will-fix-1-responsive-css-or-layout-bug-a8f9",
    "/sellers/s-sara",
    "/login",
    "/register",
    "/register?role=freelancer",
  ],
  client: [
    "/gigs/i-will-design-1-modern-vector-app-icon-fast-b21c",
    "/orders",
    "/orders/84920",
    "/orders/84918",
    "/orders/84931",
    "/inbox",
    "/inbox?thread=84920",
    "/wallet",
    "/settings/security",
    "/settings/notifications",
  ],
  freelancer: ["/seller/dashboard", "/seller/profile", "/gigs/new", "/orders", "/orders/84912", "/orders/84925", "/inbox?thread=84925", "/wallet", "/sellers/s-alex"],
  admin: ["/admin/verifications", "/admin/disputes", "/orders/84905"],
};

for (const [who, paths] of Object.entries(PAGES)) {
  for (const path of paths) {
    test(`[${who}] ${path} has no WCAG 2.1 AA violations`, async ({ page }) => {
      if (who !== "guest") await loginAs(page, who as Who);
      await page.goto(path);
      await expectNoA11yViolations(page);
    });
  }
}

test("landing CTA opens sign-up with the client type preselected", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Hire a freelancer/ }).click();
  await expect(page).toHaveURL(/\/register\?role=client/, { timeout: 30_000 }); // first dev compile is slow
  await expect(page.getByRole("radio", { name: /I'm a client/ })).toBeChecked();
});

test("registering as a freelancer locks the account to the seller side", async ({ page }) => {
  await page.goto("/register?role=freelancer");
  await page.waitForLoadState("networkidle"); // wait for hydration before typing
  await page.getByLabel("Full name").fill("Jamie Rivera");
  await page.getByLabel("Email").fill(`jamie+${Date.now()}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("secret-123!");
  await page.getByRole("button", { name: "Create freelancer account" }).click();
  await expect(page).toHaveURL(/\/seller\/dashboard/, { timeout: 30_000 }); // first dev compile is slow

  // Freelancers can't order other people's gigs.
  await page.goto("/gigs/i-will-design-1-modern-vector-app-icon-fast-b21c");
  // The order panel renders twice (mobile + desktop layouts); check the visible one.
  await expect(page.getByText("Freelancer accounts sell gigs and can't place orders.").filter({ visible: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Order Now/ })).toHaveCount(0);
});

test("there is no buying/selling switch", async ({ page }) => {
  await loginAs(page, "client");
  await page.goto("/orders");
  await expect(page.getByRole("heading", { name: "My orders" })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Selling$/ })).toHaveCount(0);
});

test("clients can't reach freelancer pages, freelancers can't reach client orders", async ({ page }) => {
  await loginAs(page, "client");
  await page.goto("/seller/dashboard");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();

  await loginAs(page, "freelancer");
  await page.goto("/orders/84920");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

test("signed-out visitors are sent to sign-in and back", async ({ page }) => {
  await page.goto("/orders");
  await expect(page).toHaveURL(/\/login\?next=%2Forders/);
  await page.waitForLoadState("networkidle"); // wait for hydration before clicking
  await page.getByRole("button", { name: "Client" }).click();
  await expect(page).toHaveURL(/\/orders$/, { timeout: 30_000 });
});

test("client journey: gig → checkout → requirements → in progress", async ({ page }) => {
  await loginAs(page, "client");
  await page.goto("/gigs/i-will-design-1-modern-vector-app-icon-fast-b21c");
  await page.getByRole("button", { name: /Order Now/ }).last().click();
  await page.getByRole("button", { name: /Confirm purchase/ }).click();
  await expect(page).toHaveURL(/\/orders\/84931/, { timeout: 30_000 }); // first dev compile is slow
  await page.getByLabel(/App name/).fill("Ledgerly budgeting app");
  await page.getByLabel(/Colours or styles/).fill("Emerald green, flat");
  await page.getByRole("button", { name: /Submit requirements & start order/ }).click();
  await expect(page.getByText("In progress", { exact: true }).first()).toBeVisible();
});

test("client accepts a delivery", async ({ page }) => {
  await loginAs(page, "client");
  await page.goto("/orders/84920");
  await page.getByRole("button", { name: "Accept Delivery & Release Funds" }).click();
  await page.getByRole("button", { name: "Accept & complete order" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Delivery accepted" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Leave a review" })).toBeVisible();
});

test("revision request enforces 20-character minimum", async ({ page }) => {
  await loginAs(page, "client");
  await page.goto("/orders/84920");
  await page.getByRole("button", { name: /Request Revision/ }).click();
  await page.getByLabel("What should be changed?").fill("too short");
  await page.getByRole("button", { name: "Send revision request" }).click();
  await expect(page.getByText("Please write at least 20 characters")).toBeVisible();
});

test("freelancer inbox: open a thread and reply", async ({ page }) => {
  await loginAs(page, "freelancer");
  await page.goto("/inbox");
  await page.getByRole("button", { name: /Priya Nair/ }).click();
  await page.getByLabel("Message", { exact: true }).fill("On it, fix coming within the hour.");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("On it, fix coming within the hour.").first()).toBeVisible();
});

test("gig images load from local storage", async ({ page }) => {
  await page.goto("/gigs");
  const first = page.locator("article img").first();
  await expect(first).toBeVisible();
  expect(await first.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
});

test("every landing, header and footer link resolves", async ({ page, request }) => {
  const hrefs = new Set<string>();
  for (const path of ["/", "/gigs"]) {
    await page.goto(path);
    const found = await page.locator("a[href^='/']").evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).getAttribute("href")!));
    found.forEach((h) => hrefs.add(h.split("#")[0] || "/"));
  }
  for (const href of Array.from(hrefs)) {
    const res = await request.get(href);
    expect(res.status(), href).toBeLessThan(400);
  }
});
