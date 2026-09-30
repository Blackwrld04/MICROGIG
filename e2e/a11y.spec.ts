import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// WCAG 2.1 AA — PRD §17. Every route in the app.
const PAGES = [
  "/gigs",
  "/categories/programming-tech",
  "/gigs/i-will-fix-1-responsive-css-or-layout-bug-a8f9",
  "/gigs/i-will-design-1-modern-vector-app-icon-fast-b21c",
  "/gigs/new",
  "/gigs?category=video-animation",
  "/sellers/s-sara",
  "/sellers/s-alex",
  "/inbox",
  "/inbox?thread=84925",
  "/orders",
  "/orders?role=seller&tab=active",
  "/orders/84920",
  "/orders/84918",
  "/orders/84931",
  "/orders/84912",
  "/wallet",
  "/seller/dashboard",
  "/seller/profile",
  "/settings/security",
  "/settings/notifications",
  "/admin/verifications",
  "/admin/disputes",
  "/login",
  "/register",
];

for (const path of PAGES) {
  test(`${path} has no WCAG 2.1 AA violations`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  });
}

test("catalog filters by category via the URL", async ({ page }) => {
  await page.goto("/gigs");
  await page.getByRole("navigation", { name: "Filter by category" }).getByRole("link", { name: "Graphics & Design" }).click();
  await expect(page).toHaveURL(/category=graphics-design/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Graphics & Design");
});

test("buyer journey: gig → checkout → requirements → in progress", async ({ page }) => {
  await page.goto("/gigs/i-will-design-1-modern-vector-app-icon-fast-b21c");
  await page.getByRole("button", { name: /Order Now/ }).last().click();
  await page.getByRole("button", { name: /Confirm purchase/ }).click();
  await expect(page).toHaveURL(/\/orders\/84931/);
  await page.getByLabel(/App name/).fill("Ledgerly budgeting app");
  await page.getByLabel(/Colours or styles/).fill("Emerald green, flat");
  await page.getByRole("button", { name: /Submit requirements & start order/ }).click();
  await expect(page.getByText("In progress", { exact: true }).first()).toBeVisible();
});

test("buyer accepts a delivery", async ({ page }) => {
  await page.goto("/orders/84920");
  await page.getByRole("button", { name: "Accept Delivery & Release Funds" }).click();
  await page.getByRole("button", { name: "Accept & complete order" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Delivery accepted" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Leave a review" })).toBeVisible();
});

test("revision request enforces 20-character minimum", async ({ page }) => {
  await page.goto("/orders/84920");
  await page.getByRole("button", { name: /Request Revision/ }).click();
  await page.getByLabel("What should be changed?").fill("too short");
  await page.getByRole("button", { name: "Send revision request" }).click();
  await expect(page.getByText("Please write at least 20 characters")).toBeVisible();
});

test("inbox: open a thread and reply", async ({ page }) => {
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

test("every header and footer link resolves", async ({ page, request }) => {
  await page.goto("/gigs");
  const hrefs = await page.locator("header a[href^='/'], footer a[href^='/']").evaluateAll((els) =>
    Array.from(new Set(els.map((e) => (e as HTMLAnchorElement).getAttribute("href")!))),
  );
  for (const href of hrefs) {
    const res = await request.get(href);
    expect(res.status(), href).toBeLessThan(400);
  }
});
