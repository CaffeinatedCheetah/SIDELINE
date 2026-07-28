import { HallPeriod, Prisma, type PrismaClient } from "@prisma/client";

import { rankHallCandidates } from "@/lib/scoring/hall-of-flame";

export async function generateHallOfFlame(
  db: PrismaClient,
  period: HallPeriod,
  now = new Date(),
) {
  const periodStart = hallPeriodStartUtc(period, now);
  const takes = await db.take.findMany({
    where: {
      status: "ACTIVE",
      createdAt: period === "ALL_TIME" ? undefined : { gte: periodStart },
    },
    include: {
      _count: { select: { reactions: true, comments: true } },
      author: { select: { status: true } },
    },
  });
  const ranked = rankHallCandidates(
    takes.map((take) => ({
      id: take.id,
      quality: Math.min(1, take.body.length / 400),
      conversation: Math.min(
        1,
        (take._count.reactions + take._count.comments) / 25,
      ),
      trust: take.author.status === "ACTIVE" ? 1 : 0,
      reports: 0,
      isActive: take.status === "ACTIVE",
    })),
  );
  return db.$transaction(async (transaction) => {
    await transaction.hallOfFlameEntry.deleteMany({
      where: { period, periodStart, leagueId: null, communityId: null },
    });
    if (!ranked.length) return [];
    await transaction.hallOfFlameEntry.createMany({
      data: ranked.slice(0, 100).map((entry) => ({
        period,
        periodStart,
        rank: entry.rank,
        score: entry.score,
        takeId: entry.id,
        reasons: { qualityConversationTrust: true },
      })),
    });
    return transaction.hallOfFlameEntry.findMany({
      where: { period, periodStart, leagueId: null, communityId: null },
      orderBy: { rank: "asc" },
    });
  });
}

export function hallPeriodStartUtc(period: HallPeriod, now: Date) {
  if (period === "ALL_TIME") return new Date(0);
  if (period === "MONTHLY")
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  if (period === "WEEKLY") {
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const daysSinceMonday = (start.getUTCDay() + 6) % 7;
    start.setUTCDate(start.getUTCDate() - daysSinceMonday);
    return start;
  }
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

export async function runHallOfFlameJob(
  db: PrismaClient,
  period: HallPeriod,
  now = new Date(),
) {
  const lockKey = `hall-of-flame:${period}`;
  let run;
  try {
    run = await db.operationalJobRun.create({
      data: {
        jobKey: "hall-of-flame",
        period,
        status: "RUNNING",
        lockKey,
        metadata: { boundary: hallPeriodStartUtc(period, now).toISOString() },
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return { status: "SKIPPED_OVERLAP" as const };
    throw error;
  }

  try {
    const eligibleCount = await db.take.count({
      where: {
        status: "ACTIVE",
        author: { status: "ACTIVE" },
        createdAt:
          period === "ALL_TIME"
            ? undefined
            : { gte: hallPeriodStartUtc(period, now) },
      },
    });
    const entries = await generateHallOfFlame(db, period, now);
    await db.operationalJobRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCEEDED",
        lockKey: null,
        finishedAt: new Date(),
        eligibleCount,
        processedCount: entries.length,
        skippedCount: Math.max(0, eligibleCount - entries.length),
      },
    });
    return { status: "SUCCEEDED" as const, entries, runId: run.id };
  } catch (error) {
    await db.operationalJobRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        lockKey: null,
        finishedAt: new Date(),
        errorCount: 1,
        errorMessage:
          error instanceof Error
            ? error.message.slice(0, 1000)
            : "Unknown error",
      },
    });
    throw error;
  }
}
