import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { db } from "@/lib/db/client";
import { materializeContest } from "@/lib/sports/materializer";
import { materializeGameMoments } from "@/lib/sports/moments/materializer";
import { normalizeEspnMlbPlays } from "@/lib/sports/moments/providers/espn-mlb";
import type { Contest } from "@/lib/sports/types";
import contests from "@/tests/fixtures/sports/contests.json";
import moments from "@/tests/fixtures/sports/espn-mlb-plays.json";

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

  await page.goto("/settings?section=account");
  await page
    .getByRole("button", { name: "Log out" })
    .click({ noWaitAfter: true });
  await page.waitForURL("/", { waitUntil: "load", timeout: 30_000 });
  const session = await page.request.get("/api/auth/session");
  expect(await session.json()).toBeNull();

  await page.goto("/arena");
  await expect(page).toHaveURL(/\/auth\/sign-in/);
  await expect(page).toHaveURL(/callbackUrl=%2Farena/);
});

test("signed-in fan follows a team, sees My Teams after refresh, and unfollows", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const team = await db.team.findFirstOrThrow({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const user = await db.user.findUniqueOrThrow({
    where: { email: "demo@fantakes.local" },
  });
  await db.teamFollow.deleteMany({ where: { userId: user.id } });
  await page.goto("/auth/sign-in?callbackUrl=/teams");
  await page.getByLabel("Email").fill("demo@fantakes.local");
  await page.getByRole("button", { name: "Continue with email" }).click();
  await expect(page).toHaveURL(/\/teams$/);

  const teamCard = page.locator(`[data-team-card="${team.id}"]`);
  await teamCard.getByRole("button", { name: "Follow" }).click();
  await expect(
    teamCard.getByRole("button", { name: "Following" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    teamCard.getByRole("button", { name: "Following" }),
  ).toBeVisible();

  await page.goto("/");
  const myTeams = page.locator("section", {
    has: page.getByRole("heading", { name: "My Teams" }),
  });
  await expect(myTeams.getByText(team.name).first()).toBeVisible();
  await myTeams.getByRole("button", { name: "Following" }).click();
  await expect(
    page.getByRole("heading", { name: "Build your SIDELINE" }),
  ).toBeVisible();
});

test("authenticated fan posts an existing Take inside a fixture-backed Flash Thread", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const game = await materializeContest(contests[0] as Contest);
  const scoringMoment = normalizeEspnMlbPlays(moments, {
    gameProviderRef: game.providerRef!,
  }).find((moment) => moment.providerRef.endsWith(":play-home-run"));
  expect(scoringMoment).toBeDefined();
  await materializeGameMoments([scoringMoment!]);

  await page.goto(`/auth/sign-in?callbackUrl=/games/${game.id}`);
  await page.getByLabel("Email").fill("demo@fantakes.local");
  await page.getByRole("button", { name: "Continue with email" }).click();
  await expect(page).toHaveURL(new RegExp(`/games/${game.id}$`));
  const flashThread = page.locator("[data-featured-flash-thread]");
  await expect(
    flashThread.getByRole("heading", { name: /go-ahead two-run home run/i }),
  ).toBeVisible({ timeout: 20_000 });
  const body = `The go-ahead swing changed the game. ${randomUUID()}`;
  await flashThread.getByLabel("Add your take").fill(body);
  await flashThread.getByRole("button", { name: "Post take" }).click();
  await expect(flashThread.getByText(body, { exact: true })).toBeVisible({
    timeout: 15_000,
  });
});
