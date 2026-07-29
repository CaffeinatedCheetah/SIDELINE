import { db } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";

export type ScheduleGame = Prisma.GameGetPayload<{
  include: {
    league: true;
    homeTeam: true;
    awayTeam: true;
    _count: { select: { takes: true } };
  };
}>;

const STATUS_WEIGHT: Record<string, number> = {
  LIVE: 0,
  SCHEDULED: 1,
  FINAL: 2,
  POSTPONED: 3,
  CANCELLED: 4,
  PREGAME: 1,
  HALFTIME: 0,
};

export async function getTodaysSchedule(
  userId: string | undefined,
  limit = 6,
): Promise<{ games: ScheduleGame[]; failed: boolean }> {
  const now = new Date();
  const startOfDay = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  try {
    const [games, favoriteTeams] = await Promise.all([
      db.game.findMany({
        where: { scheduledAt: { gte: startOfDay, lt: endOfDay } },
        orderBy: { scheduledAt: "asc" },
        take: 20,
        include: {
          league: true,
          homeTeam: true,
          awayTeam: true,
          _count: { select: { takes: true } },
        },
      }) as Promise<ScheduleGame[]>,
      userId
        ? db.profile
            .findUnique({
              where: { userId },
              select: { favoriteTeams: true },
            })
            .then((p) => p?.favoriteTeams ?? [])
        : Promise.resolve<string[]>([]),
    ]);

    const isFavorite = (game: ScheduleGame) =>
      favoriteTeams.includes(game.homeTeam.key) ||
      favoriteTeams.includes(game.awayTeam.key);

    const sorted = [...games].sort((a, b) => {
      const favoriteDelta = Number(isFavorite(b)) - Number(isFavorite(a));
      if (favoriteDelta !== 0) return favoriteDelta;
      const statusDelta =
        (STATUS_WEIGHT[a.status] ?? 9) - (STATUS_WEIGHT[b.status] ?? 9);
      if (statusDelta !== 0) return statusDelta;
      return a.scheduledAt.getTime() - b.scheduledAt.getTime();
    });

    return { games: sorted.slice(0, limit), failed: false };
  } catch (error) {
    console.error(
      "[getTodaysSchedule] query failed:",
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : "unknown error",
    );
    return { games: [], failed: true };
  }
}
