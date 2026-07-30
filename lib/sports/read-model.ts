import type { GameStatus } from "@prisma/client";

import { db } from "@/lib/db/client";
import { gameStatusFromProviderState } from "@/lib/sports/game-lifecycle";
import { materializeContests } from "@/lib/sports/materializer";
import { recordSportsMetric } from "@/lib/sports/observability";
import { getSportsSchedule } from "@/lib/sports/service";
import type { Contest, ContestState } from "@/lib/sports/types";

export interface SportsGame {
  id: string;
  providerState: string | null;
  scheduledAt: Date;
  status: GameStatus;
  homeScore: number | null;
  awayScore: number | null;
  period: string | null;
  clock: string | null;
  statusDetail: string | null;
  broadcast: string | null;
  league: {
    key: string;
    name: string;
    abbreviation: string;
  };
  homeTeam: {
    name: string;
    abbreviation: string;
    logoUrl: string | null;
  };
  awayTeam: {
    name: string;
    abbreviation: string;
    logoUrl: string | null;
  };
  _count: { takes: number; follows?: number };
}

export interface SportsGameDirectory {
  games: SportsGame[];
  providerError: boolean;
  stale: boolean;
  source: "provider" | "last_good" | "database";
  fetchedAt?: string;
}

function statusFilter(status?: string): GameStatus | undefined {
  if (
    status === "LIVE" ||
    status === "HALFTIME" ||
    status === "PREGAME" ||
    status === "SCHEDULED" ||
    status === "FINAL"
  )
    return status;
  return undefined;
}

export async function getSportsGameDirectory({
  date,
  leagueKey,
  status,
  limit,
}: {
  date?: string;
  leagueKey?: string;
  status?: string;
  limit?: number;
} = {}): Promise<SportsGameDirectory> {
  const schedule = await getSportsSchedule({
    date,
    leagueKeys: leagueKey ? [leagueKey] : undefined,
  });
  const providerFallback = schedule.contests.map(contestToSportsGame);
  if (schedule.contests.length) {
    try {
      const games = await materializeContests(schedule.contests);
      return {
        games: filterAndLimit(games, status, limit),
        providerError: Boolean(schedule.error),
        stale: schedule.stale,
        source: schedule.source,
        fetchedAt: schedule.fetchedAt,
      };
    } catch (error) {
      recordSportsMetric("materialization_failure", {
        count: schedule.contests.length,
        metadata: {
          operation: "directory_materialization",
          error: error instanceof Error ? error.name : "unknown",
        },
      });
      // Persisted games remain the preferred read path if synchronization is
      // down. Provider-normalized cards remain a final read-only fallback.
    }
  }

  try {
    const games = await db.game.findMany({
      where: {
        ...(statusFilter(status) ? { status: statusFilter(status) } : {}),
        ...(leagueKey ? { league: { key: leagueKey } } : {}),
      },
      orderBy: { scheduledAt: "asc" },
      take: limit,
      include: {
        league: true,
        homeTeam: true,
        awayTeam: true,
        _count: { select: { takes: true, follows: true } },
      },
    });
    if (games.length || !providerFallback.length)
      return {
        games,
        providerError: Boolean(schedule.error),
        stale: schedule.stale,
        source: "database",
        fetchedAt: schedule.fetchedAt,
      };
    return {
      games: filterAndLimit(providerFallback, status, limit),
      providerError: true,
      stale: schedule.stale,
      source: "provider",
      fetchedAt: schedule.fetchedAt,
    };
  } catch (error) {
    recordSportsMetric("materialization_failure", {
      metadata: {
        operation: "database_fallback",
        error: error instanceof Error ? error.name : "unknown",
      },
    });
    return {
      games: filterAndLimit(providerFallback, status, limit),
      providerError: true,
      stale: schedule.stale,
      source: providerFallback.length ? "provider" : "database",
      fetchedAt: schedule.fetchedAt,
    };
  }
}

function contestToSportsGame(contest: Contest): SportsGame {
  return {
    id: `espn-${contest.league.key}-${contest.providerGameId}`,
    providerState: contest.state,
    scheduledAt: new Date(contest.scheduledAtUtc),
    status: gameStatusFromProviderState(contest.state),
    homeScore: contest.homeScore ?? null,
    awayScore: contest.awayScore ?? null,
    period: contest.period ?? null,
    clock: contest.clock ?? null,
    statusDetail: contest.detail ?? null,
    broadcast: contest.broadcast ?? null,
    league: {
      key: contest.league.key,
      name: contest.league.name,
      abbreviation: contest.league.abbreviation,
    },
    homeTeam: {
      name: contest.homeParticipant.name,
      abbreviation: contest.homeParticipant.abbreviation,
      logoUrl: contest.homeParticipant.logoUrl ?? null,
    },
    awayTeam: {
      name: contest.awayParticipant.name,
      abbreviation: contest.awayParticipant.abbreviation,
      logoUrl: contest.awayParticipant.logoUrl ?? null,
    },
    _count: { takes: 0, follows: 0 },
  };
}

function filterAndLimit(games: SportsGame[], status?: string, limit?: number) {
  const filtered = statusFilter(status)
    ? games.filter((game) => game.status === status)
    : games;
  return limit ? filtered.slice(0, limit) : filtered;
}

export function gameStatusLabel(game: SportsGame) {
  const state = game.providerState as ContestState | null;
  if (state === "in_progress")
    return [game.period, game.clock].filter(Boolean).join(" ") || "Live";
  if (state === "halftime") return "Halftime";
  if (state === "delayed") return "Delayed";
  if (state === "postponed") return "Postponed";
  if (state === "suspended") return "Suspended";
  if (state === "cancelled") return "Cancelled";
  if (state === "final") return game.statusDetail || "Final";
  if (state === "pregame") return "Pregame";
  return game.status === "LIVE"
    ? "Live"
    : game.status.charAt(0) + game.status.slice(1).toLowerCase();
}
