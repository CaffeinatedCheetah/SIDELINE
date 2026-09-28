import { createRequire } from "node:module";
import { db } from "@/lib/db/client";
import { expect, test, type Page } from "@playwright/test";

const resolveDependency = createRequire(`${process.cwd()}/package.json`);
type AxeResult = {
  violations: Array<{
    id: string;
    impact: string | null;
    help: string;
    nodes: Array<{ target: string[] }>;
  }>;
};

async function scanForSeriousViolations(page: Page) {
  await page.addScriptTag({
    path: resolveDependency.resolve("axe-core/axe.min.js"),
  });
  const results = (await page.evaluate(() =>
    (window as unknown as { axe: { run: () => Promise<AxeResult> } }).axe.run(),
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

test("authenticated pages have no serious accessibility violations", async ({
  page,
}) => {
  test.skip(
    process.env.RUN_DATABASE_E2E !== "true",
    "Requires isolated PostgreSQL",
  );
  await page.goto("/auth/sign-in?callbackUrl=/notifications");
  await page.getByLabel("Email").fill("demo@fantakes.local");
  await page.getByRole("button", { name: "Continue with email" }).click();
  await expect(page).toHaveURL(/notifications$/);
  await scanForSeriousViolations(page);
  const user = await db.user.findUniqueOrThrow({
    where: { email: "demo@fantakes.local" },
  });
  await page.goto(`/u/${user.handle}`);
  await scanForSeriousViolations(page);
});
