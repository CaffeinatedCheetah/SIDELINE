import { expect, test } from "@playwright/test";

test.skip(
  process.env.RUN_DATABASE_E2E !== "true",
  "Requires the isolated seeded PostgreSQL test database.",
);

test("development login persists and logout protects the authenticated shell", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto("/auth/sign-in?callbackUrl=/arena");
  await page.getByLabel("Email").fill("demo@fantakes.local");
  await page.getByRole("button", { name: "Continue with email" }).click();

  await expect(page).toHaveURL(/\/arena$/);
  await expect(
    page.getByRole("heading", { name: /welcome back/i }),
  ).toBeVisible({ timeout: 30_000 });

  await page.reload();
  await expect(page).toHaveURL(/\/arena$/);
  await expect(
    page.getByRole("heading", { name: /welcome back/i }),
  ).toBeVisible({ timeout: 30_000 });

  await page.goto("/settings");
  await Promise.all([
    page.waitForURL("/", { timeout: 15_000 }),
    page.getByRole("button", { name: "Log out" }).click(),
  ]);

  await page.goto("/arena");
  await expect(page).toHaveURL(/\/auth\/sign-in/);
  await expect(page).toHaveURL(/callbackUrl=%2Farena/);
});
