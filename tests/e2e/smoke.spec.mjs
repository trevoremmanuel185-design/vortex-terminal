// Playwright smoke test: connect → select market → proposal → buy → sell.
// Run with: npx playwright install --with-deps && npx playwright test
// The suite is intentionally .mjs so the strict TypeScript build never depends
// on Playwright being installed in production images.
import { expect, test } from "@playwright/test";

test.describe("VORTEX TERMINAL smoke", () => {
  test("landing page renders and terminal launches", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Trade with/i);
    await page.getByRole("link", { name: /Launch the terminal/i }).first().click();
    await expect(page.getByText(/Market watch/i).first()).toBeVisible();
  });

  test("simulated connect → select market → proposal → buy → sell", async ({ page }) => {
    await page.goto("/terminal");
    await expect(page.getByText(/SIMULATION/i).first()).toBeVisible();

    // Market selection
    await page.getByLabel("Search symbols").fill("Volatility 75");
    await page.getByRole("button", { name: /Volatility 75 \(1s\)/i }).first().click();

    // Proposal must be fresh before we can buy
    await expect(page.getByText(/fresh \d/i)).toBeVisible({ timeout: 20_000 });
    const buy = page.getByRole("button", { name: /Simulated buy/i }).first();
    await expect(buy).toBeEnabled();
    await buy.click();

    // Open position appears in the ledger
    await expect(page.getByText(/open positions/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /^Sell$/ }).first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /^Sell$/ }).first().click();
    await expect(page.getByText(/closed/i).first()).toBeVisible();
  });

  test("emergency stop and REAL guard", async ({ page }) => {
    await page.goto("/terminal");
    await page.keyboard.press("Escape");
    await expect(page.getByText(/stop active/i)).toBeVisible();
    await page.getByRole("button", { name: /^Real$/i }).first().click();
    await expect(page.getByText(/Connection & account|Type REAL to confirm|REAL/i).first()).toBeVisible();
  });

  test("mobile layout works at 360px", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto("/terminal");
    await expect(page.getByRole("navigation", { name: /Terminal sections/i })).toBeVisible();
    await page.getByRole("button", { name: /^Markets$/i }).click();
    await expect(page.getByText(/Market watch/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Rise/i }).first()).toBeVisible();
  });
});
