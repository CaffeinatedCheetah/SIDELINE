import { expect, test } from "@playwright/test";

test("visitor can discover FanTakes and reach sign in", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: /your game/i }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Join FanTakes" }).click();
  await expect(page).toHaveURL(/auth\/sign-up|auth\/sign-in/);
});

test("public navigation exposes core destinations", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Games" }).first(),
  ).toHaveAttribute("href", "/games");
  await expect(
    page
      .getByRole("navigation", { name: "Footer" })
      .getByRole("link", { name: "Community guidelines" }),
  ).toBeVisible();
});
