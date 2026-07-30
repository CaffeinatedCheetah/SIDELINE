import { expect, test } from "@playwright/test";

import { db } from "@/lib/db/client";

test.skip(
  process.env.RUN_DATABASE_E2E !== "true",
  "Requires the isolated seeded PostgreSQL test database.",
);

test("all public routes render without runtime or console errors", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const [game, debate, community, user] = await Promise.all([
    db.game.findFirstOrThrow({ select: { id: true } }),
    db.debate.findFirstOrThrow({ select: { id: true } }),
    db.community.findFirstOrThrow({ select: { slug: true } }),
    db.user.findFirstOrThrow({
      where: { email: "demo@fantakes.local" },
      select: { handle: true },
    }),
  ]);
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  const routes = [
    "/",
    "/games",
    "/teams",
    `/games/${game.id}`,
    "/debates",
    `/debates/${debate.id}`,
    "/communities",
    `/communities/${community.slug}`,
    "/hall-of-flame",
    `/users/${user.handle}`,
    "/auth/sign-in",
    "/auth/sign-up",
    "/help",
    "/guidelines",
    "/terms",
    "/privacy",
  ];
  for (const route of routes) {
    const probe = await page.request.get(route, { maxRedirects: 0 });
    expect(probe.status(), route).toBeLessThan(400);
    try {
      await page.goto(route, { waitUntil: "domcontentloaded" });
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !["ERR_ABORTED", "ERR_NETWORK_IO_SUSPENDED"].some((code) =>
          error.message.includes(code),
        )
      )
        throw error;
      await page.goto(route, { waitUntil: "domcontentloaded" });
    }
    await expect(page.locator("main")).toBeVisible({ timeout: 30_000 });
  }
  expect(consoleErrors).toEqual([]);
});

for (const width of [320, 375, 390, 430, 768, 1024, 1280, 1440]) {
  test(`homepage has no horizontal overflow at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("main")).toBeVisible({ timeout: 30_000 });
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  });
}

test("team discovery has no horizontal overflow across supported breakpoints", async ({
  page,
}) => {
  for (const width of [320, 375, 390, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/teams", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "Choose your teams" }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole("link", { name: "Follow" }).first(),
    ).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(
      dimensions.scrollWidth,
      `${width}px team discovery`,
    ).toBeLessThanOrEqual(dimensions.clientWidth);
  }
});

test("Game Room has no horizontal overflow across supported breakpoints", async ({
  page,
}) => {
  const game = await db.game.findFirstOrThrow({ select: { id: true } });
  for (const width of [320, 375, 390, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`/games/${game.id}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-game-room-shell]")).toBeVisible({
      timeout: 30_000,
    });
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth, `${width}px Game Room`).toBeLessThanOrEqual(
      dimensions.clientWidth,
    );
  }
});
