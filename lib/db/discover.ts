import { db } from "@/lib/db/client";

const ACTIVE_GAME_STATUSES = ["LIVE", "HALFTIME", "PREGAME"] as const;

export async function getDiscoverFeed() {
  const [games, debates, flashThreads, teams, leagues, recentMoments, people] =
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
      db.user.findMany({
        where: {
          status: "ACTIVE",
          deletedAt: null,
        },
        orderBy: [
          { followers: { _count: "desc" } },
          { takes: { _count: "desc" } },
          { createdAt: "asc" },
        ],
        take: 16,
        select: {
          id: true,
          handle: true,
          displayName: true,
          image: true,
          profile: { select: { avatarUrl: true, bio: true } },
          preferences: { select: { privacySettings: true } },
          _count: { select: { followers: true, takes: true } },
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
  const discoverablePeople = people
    .filter((person) => {
      const privacy = person.preferences?.privacySettings;
      return !(
        privacy &&
        typeof privacy === "object" &&
        !Array.isArray(privacy) &&
        (privacy as Record<string, unknown>).profileDiscoverable === false
      );
    })
    .slice(0, 8);

  return {
    trendingGames,
    debates,
    flashThreads,
    teams,
    leagues,
    recentMoments,
    people: discoverablePeople,
  };
}
