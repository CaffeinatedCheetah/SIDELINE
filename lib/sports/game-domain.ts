import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db/client";
import type { GamePhase } from "@/lib/sports/game-lifecycle";

export type { GamePhase } from "@/lib/sports/game-lifecycle";

const canonicalGameInclude = {
  league: true,
  homeTeam: true,
  awayTeam: true,
  _count: { select: { follows: true, takes: true } },
} satisfies Prisma.GameInclude;

export type CanonicalGameRecord = Prisma.GameGetPayload<{
  include: typeof canonicalGameInclude;
}>;

export type CanonicalGame = {
  id: string;
  providerRef: string | null;
  leagueId: string;
  leagueKey: string;
  leagueName: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeam: {
    id: string;
    name: string;
    abbreviation: string;
    logoUrl: string | null;
  };
  awayTeam: {
    id: string;
    name: string;
    abbreviation: string;
    logoUrl: string | null;
  };
  startsAt: string;
  phase: GamePhase;
  homeScore: number | null;
  awayScore: number | null;
  period: string | null;
  clock: string | null;
  detail: string | null;
  venue: string | null;
  broadcast: string[];
  lastProviderUpdateAt: string | null;
  lastSyncedAt: string | null;
  followerCount: number;
  takeCount: number;
  version: number;
};

export function toCanonicalGame(game: CanonicalGameRecord): CanonicalGame {
  return {
    id: game.id,
    providerRef: game.providerRef,
    leagueId: game.leagueId,
    leagueKey: game.league.key,
    leagueName: game.league.abbreviation,
    homeTeamId: game.homeTeamId,
    awayTeamId: game.awayTeamId,
    homeTeam: {
      id: game.homeTeam.id,
      name: game.homeTeam.name,
      abbreviation: game.homeTeam.abbreviation,
      logoUrl: game.homeTeam.logoUrl,
    },
    awayTeam: {
      id: game.awayTeam.id,
      name: game.awayTeam.name,
      abbreviation: game.awayTeam.abbreviation,
      logoUrl: game.awayTeam.logoUrl,
    },
    startsAt: game.scheduledAt.toISOString(),
    phase: game.status,
    homeScore: game.homeScore,
    awayScore: game.awayScore,
    period: game.period,
    clock: game.clock,
    detail: game.statusDetail,
    venue: game.venue,
    broadcast: game.broadcast
      ? game.broadcast
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      : [],
    lastProviderUpdateAt: game.providerUpdatedAt?.toISOString() ?? null,
    lastSyncedAt: game.lastSyncedAt?.toISOString() ?? null,
    followerCount: game._count.follows,
    takeCount: game._count.takes,
    version: game.version,
  };
}

export async function getCanonicalGame(gameId: string) {
  const game = await db.game.findUnique({
    where: { id: gameId },
    include: canonicalGameInclude,
  });
  return game ? toCanonicalGame(game) : null;
}
