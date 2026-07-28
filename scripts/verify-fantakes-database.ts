import { spawnSync } from "node:child_process";

const databaseUrl = process.env.FANTAKES_TEST_DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "FANTAKES_TEST_DATABASE_URL is required and must point to a disposable FanTakes test database.",
  );
}
const parsed = new URL(databaseUrl);
if (
  parsed.hostname.includes("supabase") &&
  process.env.ALLOW_REMOTE_FANTAKES_TEST_DB !== "true"
) {
  throw new Error(
    "Remote FanTakes database verification requires ALLOW_REMOTE_FANTAKES_TEST_DB=true.",
  );
}
if (
  process.env.PRODUCTION_DATABASE_URL &&
  databaseUrl === process.env.PRODUCTION_DATABASE_URL
) {
  throw new Error("Refusing to run FanTakes tests against Production.");
}

const node = process.execPath;
const environment: NodeJS.ProcessEnv = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  DIRECT_URL: process.env.FANTAKES_TEST_DIRECT_URL ?? databaseUrl,
  RUN_DATABASE_TESTS: "true",
  ENABLE_DEV_AUTH: "true",
  NODE_ENV: "test",
};

for (const command of [
  ["node_modules/prisma/build/index.js", "migrate", "deploy"],
  ["node_modules/prisma/build/index.js", "db", "seed"],
  [
    "node_modules/vitest/vitest.mjs",
    "run",
    "tests/integration/database-flows.test.ts",
    "tests/integration/sports-materialization.test.ts",
  ],
]) {
  const result = spawnSync(node, command, {
    cwd: process.cwd(),
    env: environment,
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
