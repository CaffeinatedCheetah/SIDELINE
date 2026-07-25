import { expect, test, type Page } from "@playwright/test";

// axe-core is injected via CDN rather than added as an npm dependency,
// so this test introduces zero package.json / lockfile changes.
const AXE_CORE_CDN =
  "https://cdn.jsdelivr.net/npm/axe-core@4.10.2/axe.min.js";

type AxeResult = {
  violations: Array<{
    id: string;
    impact: string | null;
    help: string;
    nodes: Array<{ target: string[] }>;
  }>;
};

async function scanForSeriousViolations(page: Page) {
  await page.addScriptTag({ url: AXE_CORE_CDN });
  const results = (await page.evaluate(
    () => (window as unknown as { axe: { run: () => Promise<AxeResult> } }).axe.run(),
  )) as AxeResult;

  const seriousOrCritical = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );

  expect(
    seriousOrCritical,
    seriousOrCritical
      .map(
        (v) =>
          `${v.impact}: ${v.id} — ${v.help} (${v.nodes.length} node(s): ${v.nodes
            .map((n) => n.target.join(" "))
            .join(", ")})`,
      )
      .join("\n"),
  ).toEqual([]);
}

// Routes that render without an authenticated session or live database,
// consistent with this app's force-dynamic + try/catch fallback pattern.
const PUBLIC_ROUTES = ["/", "/games", "/communities", "/auth/sign-in"];

for (const route of PUBLIC_ROUTES) {
  test(`no serious/critical axe violations on ${route}`, async ({ page }) => {
    await page.goto(route);
    await scanForSeriousViolations(page);
  });
}

// Game Room, Notifications, and Profile require an authenticated session
// backed by real seeded data. That infrastructure doesn't exist in CI yet
// (same gap documented for tests/e2e/authenticated-database.spec.ts) — this
// is intentionally skipped rather than scanning a redirected sign-in page
// and reporting false coverage.
test.skip(
  process.env.RUN_DATABASE_E2E !== "true",
  "Requires the isolated seeded PostgreSQL test database — same blocker as authenticated-database.spec.ts. " +
    "Once available, extend PUBLIC_ROUTES-style coverage to /games/[a live gameId], /notifications, and a profile route.",
);
test("no serious/critical axe violations on authenticated routes (blocked without seeded test DB)", async () => {
  // Intentionally left as a documented placeholder; see skip reason above.
});
