import { db } from "@/lib/db/client";
import { LEAGUES, fetchEspnEvent } from "@/lib/sports/espn";

const SPORT_NAMES: Record<string, string> = {
  basketball: "Basketball",
  football: "Football",
  baseball: "Baseball",
  hockey: "Hockey",
  soccer: "Soccer",
};

/**
 * Lazily creates (or finds) a real Prisma Game row for an ESPN-sourced
 * event, so takes/debates/predictions have a real foreign key to attach to
 * -- matches this app's "database games are for games with user content
 * attached" boundary: the games LIST stays ESPN-live-only (lib/sports/
 * espn.ts, never written to the DB), and a row only gets materialized the
 * moment someone actually clicks into a specific game.
 *
 * Idempotent: keyed by providerRef = `espn:<leagueKey>:<eventId>`, while
 * safely adopting rows created under the legacy hyphenated scheme. A second click (or
 * a second visitor) resolves to the same row rather than duplicating it.
 * Team rows are keyed by ESPN's own numeric team id (`espn-team-<id>`),
 * namespaced separately from lib/sports/sync.ts's BallDontLie-keyed teams
 * (`<league>-<providerTeamKey>`) since the two providers use unrelated id
 * schemes -- a real team could exist as two separate Team rows if both
 * providers ever populate the same league, which is an acceptable,
 * flagged imperfection rather than a fragile heuristic guess at unifying
 * unrelated provider ids.
 *
 * Returns null if the event doesn't exist (bad id) or isn't a team-sport
 * league (UFC fights have no home/away pairing on this endpoint either,
 * so they're excluded from materialization, not just the scoreboard).
 */
export async function materializeEspnGame(
  leagueKey: string,
  eventId: string,
): Promise<string | null> {
  const providerRef = `espn:${leagueKey}:${eventId}`;
  const legacyProviderRef = `espn-${leagueKey}-${eventId}`;
  const existing = await db.game.findUnique({
    where: { providerRef },
    select: { id: true },
  });
  if (existing) return existing.id;
  const legacy = await db.game.findUnique({
    where: { providerRef: legacyProviderRef },
    select: { id: true },
  });
  if (legacy)
    return (
      await db.game.update({
        where: { id: legacy.id },
        data: { providerRef, provider: "espn" },
        select: { id: true },
      })
    ).id;

  const leagueConfig = LEAGUES.find(
    (l) => l.key === leagueKey && l.kind === "team",
  );
  if (!leagueConfig) return null;
  const game = await fetchEspnEvent(leagueKey, eventId);
  if (!game || !game.homeTeam.externalId || !game.awayTeam.externalId)
    return null;

  const sport = await db.sport.upsert({
    where: { key: leagueConfig.espnSport },
    update: {},
    create: {
      key: leagueConfig.espnSport,
      name: SPORT_NAMES[leagueConfig.espnSport] ?? leagueConfig.espnSport,
    },
  });
  const league = await db.league.upsert({
    where: { key: leagueKey },
    update: {},
    create: {
      key: leagueKey,
      sportId: sport.id,
      name: leagueConfig.label,
      abbreviation: leagueConfig.label,
    },
  });
  const [homeTeam, awayTeam] = await Promise.all([
    db.team.upsert({
      where: { key: `espn-team-${game.homeTeam.externalId}` },
      update: { name: game.homeTeam.name, logoUrl: game.homeTeam.logo },
      create: {
        key: `espn-team-${game.homeTeam.externalId}`,
        leagueId: league.id,
        name: game.homeTeam.name,
        abbreviation: game.homeTeam.abbreviation,
        logoUrl: game.homeTeam.logo,
      },
    }),
    db.team.upsert({
      where: { key: `espn-team-${game.awayTeam.externalId}` },
      update: { name: game.awayTeam.name, logoUrl: game.awayTeam.logo },
      create: {
        key: `espn-team-${game.awayTeam.externalId}`,
        leagueId: league.id,
        name: game.awayTeam.name,
        abbreviation: game.awayTeam.abbreviation,
        logoUrl: game.awayTeam.logo,
      },
    }),
  ]);

  const created = await db.game.upsert({
    where: { providerRef },
    update: {},
    create: {
      providerRef,
      provider: "espn",
      leagueId: league.id,
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      scheduledAt: new Date(game.scheduledAt),
      status: game.status === "CANCELED" ? "CANCELLED" : game.status,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
    },
  });
  return created.id;
}
