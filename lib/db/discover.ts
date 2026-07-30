import { db } from "@/lib/db/client";

const ACTIVE_GAME_STATUSES = ["LIVE", "HALFTIME", "PREGAME"] as const;

export async function getDiscoverFeed() {
  const [games, debates, flashThreads, teams, leagues, recentMoments] =
    await Promise.all([
      db.game.findMany({
        where: { status: { in: [...ACTIVE_GAME_STATUSES] } },
        orderBy: [{ scheduledAt: "asc" }],
        take: 18,
        include: {
          league: true,
          homeTeam: true,
          awayTeam: true,
          _count: { select: { takes: true, follows: true } },
        },
      }),
      db.debate.findMany({
        where: { status: "OPEN" },
        orderBy: [
          { votes: { _count: "desc" } },
          { comments: { _count: "desc" } },
          { createdAt: "desc" },
        ],
        take: 6,
        include: {
          game: { include: { league: true } },
          options: {
            orderBy: { displayOrder: "asc" },
            include: { _count: { select: { votes: true } } },
          },
          _count: { select: { comments: true } },
        },
      }),
      db.flashThread.findMany({
        where: { status: "ACTIVE" },
        orderBy: [
          { takes: { _count: "desc" } },
          { moment: { importance: "desc" } },
          { createdAt: "desc" },
        ],
        take: 6,
        include: {
          game: {
            include: { league: true, homeTeam: true, awayTeam: true },
          },
          moment: true,
          _count: { select: { takes: true } },
        },
      }),
      db.team.findMany({
        orderBy: [{ followers: { _count: "desc" } }, { name: "asc" }],
        take: 8,
        include: {
          league: true,
          _count: { select: { followers: true } },
        },
      }),
      db.league.findMany({
        where: { active: true },
        orderBy: [{ games: { _count: "desc" } }, { name: "asc" }],
        take: 6,
        include: {
          sport: true,
          _count: { select: { teams: true, games: true } },
        },
      }),
      db.gameMoment.findMany({
        orderBy: { occurredAt: "desc" },
        take: 8,
        include: {
          game: {
            include: { league: true, homeTeam: true, awayTeam: true },
          },
          flashThread: { select: { id: true } },
        },
      }),
    ]);

  const trendingGames = games
    .sort(
      (left, right) =>
        right._count.takes +
          right._count.follows -
          (left._count.takes + left._count.follows) ||
        left.scheduledAt.getTime() - right.scheduledAt.getTime(),
    )
    .slice(0, 6);

  return {
    trendingGames,
    debates,
    flashThreads,
    teams,
    leagues,
    recentMoments,
  };
}
