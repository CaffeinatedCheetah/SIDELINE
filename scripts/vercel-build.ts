import { spawnSync } from "node:child_process";

function run(
  command: string,
  args: string[],
  environment: NodeJS.ProcessEnv = process.env,
) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: environment,
    stdio: "inherit",
  });
  return result.status === 0;
}

function runRequired(command: string, args: string[]) {
  if (!run(command, args)) process.exit(1);
}

const node = process.execPath;

if (process.env.VERCEL_ENV === "production") {
  console.info("Applying pending FanTakes database migrations.");
  const candidates = [
    ["POSTGRES_URL_NON_POOLING", process.env.POSTGRES_URL_NON_POOLING],
    ["DIRECT_URL", process.env.DIRECT_URL],
    ["DATABASE_URL", process.env.DATABASE_URL],
  ].filter(
    (entry, index, entries): entry is [string, string] =>
      Boolean(entry[1]) &&
      entries.findIndex((candidate) => candidate[1] === entry[1]) === index,
  );
  let migrated = false;
  for (const [label, url] of candidates) {
    console.info(`Trying FanTakes migration connection: ${label}.`);
    migrated = run(
      node,
      ["node_modules/prisma/build/index.js", "migrate", "deploy"],
      { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
    );
    if (migrated) break;
  }
  if (!migrated) {
    console.error("No configured FanTakes migration connection succeeded.");
    process.exit(1);
  }
  console.info("Verifying the pooled FanTakes runtime schema.");
  runRequired(node, ["scripts/verify-runtime-schema.mjs"]);
} else {
  console.info(
    `Skipping database migrations for ${process.env.VERCEL_ENV ?? "local"} build.`,
  );
}

runRequired(node, ["node_modules/next/dist/bin/next", "build", "--webpack"]);
