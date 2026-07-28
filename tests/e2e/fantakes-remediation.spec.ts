import { expect, test } from "@playwright/test";

test.skip(
  process.env.RUN_DATABASE_E2E !== "true",
  "Requires a disposable FanTakes database and deterministic provider fixture.",
);

test("guest sees synchronized sports data and reaches a persistent Game Room", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Detroit Tigers").first()).toBeVisible();
  await expect(page.getByText("Chicago Cubs").first()).toBeVisible();
  await page
    .getByRole("link", { name: /open chicago cubs at detroit tigers/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/games\/[0-9a-f-]+/);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /chicago cubs at detroit tigers/i,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /chicago cubs at detroit tigers/i,
    }),
  ).toBeVisible();
});

test("guest participation preserves the callback destination", async ({
  page,
}) => {
  await page.goto("/games");
  await page
    .getByRole("link", { name: /open chicago cubs at detroit tigers/i })
    .first()
    .click();
  await page.getByRole("textbox").fill("A guest take should require sign in.");
  await page.getByRole("button", { name: /post take/i }).click();
  await expect(page).toHaveURL(/\/auth\/sign-in\?callbackUrl=/);
  expect(decodeURIComponent(page.url())).toContain("/games/");
});

test("game times hydrate in the browser timezone without mismatch", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/games");
  const time = page.locator("time[data-timezone]").first();
  await expect(time).not.toHaveAttribute("data-timezone", "pending");
  await expect(time).not.toHaveText("Local time");
  expect(errors.filter((message) => /hydration/i.test(message))).toEqual([]);
});
