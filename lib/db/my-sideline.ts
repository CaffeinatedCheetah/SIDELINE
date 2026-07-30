import type { GameStatus, Prisma } from "@prisma/client";

import { db } from "@/lib/db/client";

const teamSelect = {
  id: true,
  name: true,
  abbreviation: true,
  city: true,
  logoUrl: true,
  primaryColor: true,
  secondaryColor: true,
  league: { select: { key: true, name: true, abbreviation: true } },
} satisfies Prisma.TeamSelect;

const gameInclude = {
  league: true,
  homeTeam: true,
  awayTeam: true,
  _count: { select: { takes: true, follows: true } },
} satisfies Prisma.GameInclude;

export type MySidelineGame = Prisma.GameGetPayload<{
  include: typeof gameInclude;
}>;

export async function getTeamDiscovery(userId?: string) {
  const [teams, follows] = await Promise.all([
    db.team.findMany({
      select: teamSelect,
      orderBy: [{ league: { abbreviation: "asc" } }, { name: "asc" }],
    }),
    userId
      ? db.teamFollow.findMany({
          where: { userId },
          select: { teamId: true },
        })
      : Promise.resolve([]),
  ]);
  return {
    teams,
    followedTeamIds: new Set(follows.map((follow) => follow.teamId)),
  };
}

export async function getMySideline(userId?: string) {
  if (!userId)
    return {
      teams: [],
      liveGames: [],
      upcomingGames: [],
      recentGames: [],
      flashThreads: [],
    };

  const follows = await db.teamFollow.findMany({
    where: { userId },
    take: 12,
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, team: { select: teamSelect } },
  });
  const teamIds = follows.map((follow) => follow.team.id);
  if (!teamIds.length)
    return {
      teams: [],
      liveGames: [],
      upcomingGames: [],
      recentGames: [],
      flashThreads: [],
    };

  const teamWhere = {
    OR: [{ homeTeamId: { in: teamIds } }, { awayTeamId: { in: teamIds } }],
  };
  const now = new Date();
  const [liveGames, upcomingGames, recentGames, flashThreads] =
    await Promise.all([
      db.game.findMany({
        where: {
          ...teamWhere,
          status: { in: ["LIVE", "HALFTIME"] satisfies GameStatus[] },
        },
        include: gameInclude,
        orderBy: { scheduledAt: "asc" },
        take: 6,
      }),
      db.game.findMany({
        where: {
          AND: [
            teamWhere,
            {
              OR: [
                { status: "PREGAME" },
                { status: "SCHEDULED", scheduledAt: { gte: now } },
              ],
            },
          ],
        },
        include: gameInclude,
        orderBy: { scheduledAt: "asc" },
        take: 6,
      }),
      db.game.findMany({
        where: { ...teamWhere, status: "FINAL" },
        include: gameInclude,
        orderBy: { scheduledAt: "desc" },
        take: 6,
      }),
      db.flashThread.findMany({
        where: { game: teamWhere },
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          moment: {
            select: {
              type: true,
              period: true,
              clock: true,
              homeScore: true,
              awayScore: true,
            },
          },
          game: {
            select: {
              id: true,
              homeTeam: { select: { name: true } },
              awayTeam: { select: { name: true } },
            },
          },
          _count: { select: { takes: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

  return {
    teams: follows.map((follow) => follow.team),
    liveGames,
    upcomingGames,
    recentGames,
    flashThreads,
  };
}
