import type { GameStatus, Prisma } from "@prisma/client";

import { db } from "@/lib/db/client";
import { materializeContests } from "@/lib/sports/materializer";
import { getSportsSchedule } from "@/lib/sports/service";
import type { ContestState } from "@/lib/sports/types";

export type SportsGame = Prisma.GameGetPayload<{
  include: {
    league: true;
    homeTeam: true;
    awayTeam: true;
    _count: { select: { takes: true } };
  };
}>;

export interface SportsGameDirectory {
  games: SportsGame[];
  providerError: boolean;
  stale: boolean;
  source: "provider" | "last_good" | "database";
  fetchedAt?: string;
}

function statusFilter(status?: string): GameStatus | undefined {
  if (status === "LIVE" || status === "SCHEDULED" || status === "FINAL")
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
    } catch {
      // Persisted games remain the safe read path if synchronization is down.
    }
  }

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
      _count: { select: { takes: true } },
    },
  });
  return {
    games,
    providerError: Boolean(schedule.error),
    stale: schedule.stale,
    source: "database",
    fetchedAt: schedule.fetchedAt,
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
  return game.status === "LIVE" ? "Live" : game.status;
}
