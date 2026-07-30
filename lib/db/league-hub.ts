import { db } from "@/lib/db/client";
import { getSupportedLeague, SUPPORTED_LEAGUES } from "@/lib/sports/leagues";

const gameInclude = {
  league: true,
  homeTeam: true,
  awayTeam: true,
  _count: { select: { takes: true, follows: true } },
} as const;

export async function getLeagueHub(userId?: string) {
  const [databaseLeagues, leagueLiveCounts, liveGames, followedTeams] =
    await Promise.all([
      db.league.findMany({
        select: {
          id: true,
          key: true,
          _count: {
            select: { teams: true, games: true },
          },
        },
      }),
      db.game.groupBy({
        by: ["leagueId"],
        where: { status: { in: ["LIVE", "HALFTIME"] } },
        _count: { _all: true },
      }),
      db.game.findMany({
        where: { status: { in: ["LIVE", "HALFTIME"] } },
        include: gameInclude,
        orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
        take: 6,
      }),
      userId
        ? db.teamFollow.findMany({
            where: { userId },
            select: { team: { select: { league: { select: { key: true } } } } },
          })
        : Promise.resolve([]),
    ]);
  const databaseByKey = new Map(
    databaseLeagues.map((league) => [league.key, league]),
  );
  const liveByLeagueId = new Map(
    leagueLiveCounts.map((row) => [row.leagueId, row._count._all]),
  );
  const followedByLeague = new Map<string, number>();
  for (const follow of followedTeams) {
    const key = follow.team.league.key;
    followedByLeague.set(key, (followedByLeague.get(key) ?? 0) + 1);
  }

  return {
    leagues: SUPPORTED_LEAGUES.map((league) => {
      const database = databaseByKey.get(league.key);
      return {
        ...league,
        teamCount: database?._count.teams ?? 0,
        gameCount: database?._count.games ?? 0,
        liveGameCount: database ? (liveByLeagueId.get(database.id) ?? 0) : 0,
        followedTeamCount: followedByLeague.get(league.key) ?? 0,
      };
    }),
    liveGames,
    liveGameCount: leagueLiveCounts.reduce(
      (total, row) => total + row._count._all,
      0,
    ),
    followedTeamCount: followedTeams.length,
  };
}

export async function getLeagueOverview(key: string, userId?: string) {
  const supported = getSupportedLeague(key);
  if (!supported) return null;
  const databaseLeague = await db.league.findUnique({
    where: { key },
    select: { id: true },
  });
  if (!databaseLeague)
    return {
      league: supported,
      teams: [],
      followedTeamIds: new Set<string>(),
      liveGames: [],
      upcomingGames: [],
      finalGames: [],
    };

  const teamGameWhere = { leagueId: databaseLeague.id };
  const [teams, follows, liveGames, upcomingGames, finalGames] =
    await Promise.all([
      db.team.findMany({
        where: { leagueId: databaseLeague.id },
        include: { league: true },
        orderBy: [{ city: "asc" }, { name: "asc" }],
      }),
      userId
        ? db.teamFollow.findMany({
            where: {
              userId,
              team: { leagueId: databaseLeague.id },
            },
            select: { teamId: true },
          })
        : Promise.resolve([]),
      db.game.findMany({
        where: {
          ...teamGameWhere,
          status: { in: ["LIVE", "HALFTIME"] },
        },
        include: gameInclude,
        orderBy: { scheduledAt: "asc" },
        take: 6,
      }),
      db.game.findMany({
        where: {
          ...teamGameWhere,
          status: { in: ["SCHEDULED", "PREGAME"] },
        },
        include: gameInclude,
        orderBy: { scheduledAt: "asc" },
        take: 6,
      }),
      db.game.findMany({
        where: { ...teamGameWhere, status: "FINAL" },
        include: gameInclude,
        orderBy: { scheduledAt: "desc" },
        take: 6,
      }),
    ]);

  return {
    league: supported,
    teams,
    followedTeamIds: new Set(follows.map((follow) => follow.teamId)),
    liveGames,
    upcomingGames,
    finalGames,
  };
}
