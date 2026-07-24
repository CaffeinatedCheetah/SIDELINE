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
    let response;
    try {
      response = await page.goto(route, { waitUntil: "domcontentloaded" });
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("ERR_ABORTED"))
        throw error;
      response = await page.goto(route, { waitUntil: "domcontentloaded" });
    }
    expect(response?.status(), route).toBeLessThan(400);
    await expect(page.locator("main")).toBeVisible({ timeout: 30_000 });
  }
  expect(consoleErrors).toEqual([]);
});

for (const width of [320, 375, 390, 430, 768, 1024, 1280, 1440]) {
  test(`homepage has no horizontal overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.locator("main")).toBeVisible({ timeout: 30_000 });
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  });
}
