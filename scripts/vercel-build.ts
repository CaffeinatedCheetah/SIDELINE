import { spawnSync } from "node:child_process";

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const node = process.execPath;

if (process.env.VERCEL_ENV === "production") {
  console.info("Applying pending FanTakes database migrations.");
  run(node, ["node_modules/prisma/build/index.js", "migrate", "deploy"]);
} else {
  console.info(
    `Skipping database migrations for ${process.env.VERCEL_ENV ?? "local"} build.`,
  );
}

run(node, ["node_modules/next/dist/bin/next", "build", "--webpack"]);
