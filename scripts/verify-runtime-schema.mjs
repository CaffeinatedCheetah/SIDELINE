import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const pending = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS count
    FROM "_prisma_migrations"
    WHERE "finished_at" IS NULL
      AND "rolled_back_at" IS NULL
  `;
  if (pending[0]?.count)
    throw new Error("The runtime database has unfinished Prisma migrations.");

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
