import { HallPeriod, type PrismaClient } from "@prisma/client";
import { startOfDay, startOfMonth, startOfWeek } from "date-fns";

import { rankHallCandidates } from "@/lib/scoring/hall-of-flame";

export async function generateHallOfFlame(
  db: PrismaClient,
  period: HallPeriod,
  now = new Date(),
) {
  const periodStart =
    period === "DAILY"
      ? startOfDay(now)
      : period === "WEEKLY"
        ? startOfWeek(now, { weekStartsOn: 1 })
        : period === "MONTHLY"
          ? startOfMonth(now)
          : new Date(0);
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
