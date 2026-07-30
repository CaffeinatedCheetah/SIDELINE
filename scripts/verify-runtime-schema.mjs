import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  // `prisma migrate deploy` runs immediately before this verifier and is the
  // canonical migration-state check. Historical failed migration attempts can
  // remain in `_prisma_migrations` after a later successful deploy, so inspect
  // the exact runtime contract here instead of reinterpreting Prisma history.
  await prisma.$queryRaw`
    SELECT
      "providerRef",
      "provider",
      "providerState",
      "lastSyncedAt"
    FROM "Game"
    LIMIT 0
  `;
  await prisma.$queryRaw`
    SELECT
      "flashThreadId",
      "gamePeriod",
      "gameClock",
      "homeScoreContext",
      "awayScoreContext"
    FROM "Take"
    LIMIT 0
  `;
  await prisma.$queryRaw`SELECT "id" FROM "GameMoment" LIMIT 0`;
  await prisma.$queryRaw`SELECT "id" FROM "FlashThread" LIMIT 0`;
  console.info("Verified the FanTakes runtime database schema.");
} catch (error) {
  console.error(
    "FanTakes runtime database schema verification failed. Confirm that DATABASE_URL is the pooled connection for the same Supabase project used by DIRECT_URL/POSTGRES_URL_NON_POOLING.",
  );
  console.error(error instanceof Error ? error.message : "Unknown database error");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
