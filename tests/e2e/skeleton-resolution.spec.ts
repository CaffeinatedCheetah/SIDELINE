import { expect, test } from "@playwright/test";

// Regression check for the Phase 1 audit: /games, /hall-of-flame, and
// /communities are force-dynamic Server Components that query the DB with no
// timeout. A hung query never throws, so Next's loading.tsx skeleton stays up
// forever instead of falling through to real content or an error state. This
// asserts each route resolves to real page content within a bounded window
// for a logged-out visitor.
const RESOLUTION_TIMEOUT = 15_000;

const ROUTES: Array<{ path: string; heading: string }> = [
  { path: "/games", heading: "Games" },
  { path: "/hall-of-flame", heading: "Hall of Flame" },
  { path: "/communities", heading: "Communities" },
];

for (const { path, heading } of ROUTES) {
  test(`${path} resolves past the loading skeleton, logged out`, async ({
    page,
  }) => {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { level: 1, name: heading }),
    ).toBeVisible({ timeout: RESOLUTION_TIMEOUT });
    await expect(page.getByLabel("Loading")).toBeHidden();
  });
}
