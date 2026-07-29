import type { GameStatus } from "@prisma/client";

import { checkRateLimit } from "@/lib/api/rate-limit";
import { db } from "@/lib/db/client";
import { recordSportsMetric } from "@/lib/sports/observability";
import { getSportsSchedule } from "@/lib/sports/service";

const MINUTE = 60_000;

export function serverRefreshIntervalMs({
  status,
  scheduledAt,
  endedAt,
  now = new Date(),
}: {
  status: GameStatus;
  scheduledAt: Date;
  endedAt: Date | null;
  now?: Date;
}) {
  if (status === "LIVE" || status === "HALFTIME") return 20_000;
  if (status === "PREGAME") return 5 * MINUTE;
  if (status === "FINAL")
    return endedAt && now.getTime() - endedAt.getTime() <= 30 * MINUTE
      ? 2 * MINUTE
      : null;
  if (status === "POSTPONED" || status === "CANCELLED") return null;
  return scheduledAt.getTime() - now.getTime() <= 6 * 60 * MINUTE
    ? 5 * MINUTE
    : 15 * MINUTE;
}

export async function synchronizeMlbLifecycle(now = new Date()) {
  const candidates = await db.game.findMany({
    where: {
      league: { key: "mlb" },
      scheduledAt: {
        gte: new Date(now.getTime() - 12 * 60 * MINUTE),
        lte: new Date(now.getTime() + 7 * 24 * 60 * MINUTE),
      },
    },
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      endedAt: true,
      lastSyncedAt: true,
    },
  });
  const due = candidates.filter((game) => {
    const interval = serverRefreshIntervalMs({ ...game, now });
    return (
      interval !== null &&
      (!game.lastSyncedAt ||
        now.getTime() - game.lastSyncedAt.getTime() >= interval)
    );
  });
  const dueDates = [
    ...new Set(due.map((game) => game.scheduledAt.toISOString().slice(0, 10))),
  ];
  const dates = [...dueDates];
  if (!dates.length) {
    const discovery = await checkRateLimit("sports-discovery:mlb", {
      limit: 1,
      windowMs: 15 * MINUTE,
    });
    if (discovery.allowed) {
      dates.push(now.toISOString().slice(0, 10));
      dates.push(
        new Date(now.getTime() + 24 * 60 * MINUTE).toISOString().slice(0, 10),
      );
    }
  }
  let synchronized = 0;
  let errors = 0;
  for (const date of dates) {
    const startedAt = Date.now();
    try {
      const result = await getSportsSchedule({
        date,
        leagueKeys: ["mlb"],
        now,
        materialize: true,
      });
      synchronized += result.contests.length;
      if (result.error) errors += 1;
      recordSportsMetric("lifecycle_refresh", {
        league: "mlb",
        durationMs: Date.now() - startedAt,
        count: result.contests.length,
        metadata: { date, stale: result.stale, source: result.source },
      });
    } catch (error) {
      errors += 1;
      recordSportsMetric("materialization_failure", {
        league: "mlb",
        metadata: {
          operation: "lifecycle_refresh",
          date,
          error: error instanceof Error ? error.name : "unknown",
        },
      });
    }
  }
  return {
    checkedAt: now.toISOString(),
    candidates: candidates.length,
    due: due.length,
    dates,
    synchronized,
    errors,
  };
}
