import { checkRateLimit } from "@/lib/api/rate-limit";
import { db } from "@/lib/db/client";
import { BallDontLieProvider } from "@/lib/sports/balldontlie";
import type {
  ProviderGame,
  ProviderLeague,
  SportsProvider,
} from "@/lib/sports/provider";

const LEAGUE_META: Record<
  ProviderLeague,
  {
    sportKey: string;
    sportName: string;
    leagueName: string;
    abbreviation: string;
  }
> = {
  nba: {
    sportKey: "basketball",
    sportName: "Basketball",
    leagueName: "National Basketball Association",
    abbreviation: "NBA",
  },
  nfl: {
    sportKey: "football",
    sportName: "Football",
    leagueName: "National Football League",
    abbreviation: "NFL",
  },
};

// Vercel Hobby-tier cron jobs only run daily, far too coarse for live
// scores. Real syncing instead piggybacks on real page traffic: the first
// request past this cooldown window triggers a fresh provider fetch, every
// request within it reads whatever is already in the database. This also
// naturally respects the provider's per-minute rate limit.
const SYNC_COOLDOWN_MS = 30_000;

async function upsertGames(league: ProviderLeague, games: ProviderGame[]) {
  const meta = LEAGUE_META[league];
  const sport = await db.sport.upsert({
    where: { key: meta.sportKey },
    update: {},
    create: { key: meta.sportKey, name: meta.sportName },
  });
  const leagueRow = await db.league.upsert({
    where: { key: league },
    update: {},
    create: {
      key: league,
      sportId: sport.id,
      name: meta.leagueName,
      abbreviation: meta.abbreviation,
    },
  });

  for (const game of games) {
    const [homeTeam, awayTeam] = await Promise.all([
      db.team.upsert({
        where: { key: `${league}-${game.homeTeam.key}` },
        update: { name: game.homeTeam.name, city: game.homeTeam.city },
        create: {
          key: `${league}-${game.homeTeam.key}`,
          leagueId: leagueRow.id,
          name: game.homeTeam.name,
          abbreviation: game.homeTeam.abbreviation,
          city: game.homeTeam.city,
        },
      }),
      db.team.upsert({
        where: { key: `${league}-${game.awayTeam.key}` },
        update: { name: game.awayTeam.name, city: game.awayTeam.city },
        create: {
          key: `${league}-${game.awayTeam.key}`,
          leagueId: leagueRow.id,
          name: game.awayTeam.name,
          abbreviation: game.awayTeam.abbreviation,
          city: game.awayTeam.city,
        },
      }),
    ]);

    await db.game.upsert({
      where: { providerRef: game.externalId },
      update: {
        status: game.status,
        homeScore: game.homeScore,
        awayScore: game.awayScore,
        period: game.period,
        clock: game.clock,
        startedAt: game.status === "LIVE" ? new Date() : undefined,
      },
      create: {
        providerRef: game.externalId,
        leagueId: leagueRow.id,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        scheduledAt: game.scheduledAt,
        status: game.status,
        homeScore: game.homeScore,
        awayScore: game.awayScore,
        period: game.period,
        clock: game.clock,
      },
    });
  }
}

/**
 * Fetch + upsert today's games for every supported league, cooldown-gated so
 * concurrent page loads don't all hit the provider at once. Never throws --
 * a provider or DB failure here should not break the page rendering that
 * triggered it; existing (possibly stale) rows are still servable.
 */
export async function syncTodaysGames(
  provider: SportsProvider = new BallDontLieProvider(),
): Promise<void> {
  if (!provider.isConfigured()) return;

  const leagues: ProviderLeague[] = ["nba", "nfl"];
  for (const league of leagues) {
    try {
      const gate = await checkRateLimit(`sports-sync:${provider.name}:${league}`, {
        limit: 1,
        windowMs: SYNC_COOLDOWN_MS,
      });
      if (!gate.allowed) continue;

      const games = await provider.fetchTodaysGames(league);
      if (games.length === 0) continue;
      await upsertGames(league, games);
    } catch (error) {
      console.error(
        `[syncTodaysGames] ${league} sync failed:`,
        error instanceof Error ? `${error.name}: ${error.message}` : error,
      );
    }
  }
}
