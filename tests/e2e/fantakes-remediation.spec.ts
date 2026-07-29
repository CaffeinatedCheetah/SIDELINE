import { expect, test } from "@playwright/test";
import { db } from "@/lib/db/client";
import { materializeGameMoments } from "@/lib/sports/moments/materializer";
import { normalizeEspnMlbPlays } from "@/lib/sports/moments/providers/espn-mlb";
import fixture from "@/tests/fixtures/sports/espn-mlb-plays.json";

test.describe.configure({ timeout: 90_000 });

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
    .click({ noWaitAfter: true });
  await expect(page).toHaveURL(/\/games\/[0-9a-f-]+/, { timeout: 30_000 });
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /chicago cubs at detroit tigers/i,
    }),
  ).toBeVisible();
  const gameId = page.url().split("/").at(-1)!;
  const game = await db.game.findUniqueOrThrow({
    where: { id: gameId },
    select: { providerRef: true },
  });
  const scoringMoment = normalizeEspnMlbPlays(fixture, {
    gameProviderRef: game.providerRef!,
  }).find((moment) => moment.providerRef.endsWith(":play-home-run"));
  expect(scoringMoment).toBeDefined();
  await materializeGameMoments([scoringMoment!]);
  await expect(
    page.getByRole("heading", { name: /go-ahead two-run home run/i }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel("Add your take").first()).toBeVisible();
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
    .click({ noWaitAfter: true });
  await expect(page).toHaveURL(/\/games\/[0-9a-f-]+/, { timeout: 30_000 });
  await page
    .getByRole("textbox", { name: /add your take/i })
    .first()
    .fill("A guest take should require sign in.");
  await page
    .getByRole("button", { name: /post take/i })
    .first()
    .click({ noWaitAfter: true });
  await expect(page).toHaveURL(/\/auth\/sign-in\?callbackUrl=/, {
    timeout: 30_000,
  });
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
