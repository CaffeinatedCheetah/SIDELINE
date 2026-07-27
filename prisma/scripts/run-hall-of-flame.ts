// One-off runner for the real ranking job (lib/services/hall-of-flame-job.ts),
// run manually against a real database:
// `npx tsx prisma/scripts/run-hall-of-flame.ts`
//
// Phase 14 of this project's own launch-readiness audit found the ranking
// job is real and correct but only ever reachable via an ADMIN-gated
// endpoint (POST /api/v1/jobs/hall-of-flame) with no scheduled trigger --
// "Rankings are being calculated" with zero entries just means nobody with
// an ADMIN account has ever called it. This script calls the same
// generateHallOfFlame function directly via Prisma, bypassing the need for
// an authenticated admin session, for exactly this one-time bootstrap.
// Runs all four periods so every tab on /hall-of-flame (Daily/Weekly/
// Monthly/All time) has real entries, not just whichever one a single call
// would cover.
import { PrismaClient, HallPeriod } from "@prisma/client";
import { generateHallOfFlame } from "@/lib/services/hall-of-flame-job";

const db = new PrismaClient();

async function main() {
  for (const period of Object.values(HallPeriod)) {
    const entries = await generateHallOfFlame(db, period);
    console.log(`${period}: ${entries.length} entries`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
