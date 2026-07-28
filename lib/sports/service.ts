import {
  SUPPORTED_LEAGUES,
  type SupportedLeague,
} from "@/lib/sports/leagues";
import { materializeContests } from "@/lib/sports/materializer";
import { recordSportsMetric } from "@/lib/sports/observability";
import { fetchEspnSchedule } from "@/lib/sports/providers/espn";
import { fixtureProviderAdapter } from "@/lib/sports/providers/fixture";
import type { Contest, SportsScheduleResult } from "@/lib/sports/types";

const CACHE_TTL_MS = 30_000;
const STALE_AFTER_MS = 5 * 60_000;
const cache = new Map<
  string,
  { contests: Contest[]; fetchedAt: Date; expiresAt: number }
>();

export interface SportsProviderAdapter {
  readonly provider: string;
  fetchSchedule(
    league: SupportedLeague,
    query?: { date?: string },
  ): Promise<Contest[]>;
}

const espnAdapter: SportsProviderAdapter = {
  provider: "espn",
  fetchSchedule: fetchEspnSchedule,
};

function defaultAdapters() {
  const fixturePath = process.env.SPORTS_DATA_FIXTURE_PATH;
  if (fixturePath) {
    return [fixtureProviderAdapter(fixturePath)];
  }
  return [espnAdapter];
}

export interface SportsScheduleQuery {
  date?: string;
  leagueKeys?: string[];
  now?: Date;
  materialize?: boolean;
}

export class SportsDataService {
  constructor(
    private readonly adapters: SportsProviderAdapter[] = defaultAdapters(),
  ) {}

  async getSchedule({
    date,
    leagueKeys,
    now = new Date(),
    materialize = false,
  }: SportsScheduleQuery = {}): Promise<SportsScheduleResult> {
    const leagues = SUPPORTED_LEAGUES.filter(
      (league) => !leagueKeys?.length || leagueKeys.includes(league.key),
    );
    const key = `${date ?? "current"}:${leagues.map((item) => item.key).join(",")}`;
    const cached = cache.get(key);
    if (cached && cached.expiresAt > now.getTime()) {
      recordSportsMetric("cache_hit");
      if (materialize) await materializeContests(cached.contests);
      return {
        contests: cached.contests,
        fetchedAt: cached.fetchedAt.toISOString(),
        stale: now.getTime() - cached.fetchedAt.getTime() > STALE_AFTER_MS,
        source: "provider",
      };
    }
    recordSportsMetric("cache_miss");

    const startedAt = Date.now();
    const requests = this.adapters.flatMap((adapter) =>
      leagues.map(async (league) => {
        const leagueStartedAt = Date.now();
        try {
          const contests = await adapter.fetchSchedule(league, { date });
          recordSportsMetric("provider_request", {
            league: league.key,
            durationMs: Date.now() - leagueStartedAt,
            metadata: { provider: adapter.provider, ok: true },
          });
          return contests;
        } catch (error) {
          recordSportsMetric("provider_request", {
            league: league.key,
            durationMs: Date.now() - leagueStartedAt,
            metadata: {
              provider: adapter.provider,
              ok: false,
              error: error instanceof Error ? error.name : "unknown",
            },
          });
          throw error;
        }
      }),
    );
    const results = await Promise.allSettled(requests);
    const contests = results.flatMap((result) =>
      result.status === "fulfilled" ? result.value : [],
    );
    if (contests.length) {
      const sorted = sortContests(contests, now);
      cache.set(key, {
        contests: sorted,
        fetchedAt: now,
        expiresAt: now.getTime() + CACHE_TTL_MS,
      });
      if (materialize) await materializeContests(sorted);
      recordSportsMetric("contest_synchronized", {
        durationMs: Date.now() - startedAt,
        count: contests.length,
      });
      return {
        contests: sorted,
        fetchedAt: now.toISOString(),
        stale: false,
        source: "provider",
        ...(results.some((result) => result.status === "rejected")
          ? { error: "provider_unavailable" as const }
          : {}),
      };
    }
    if (cached) {
      recordSportsMetric("stale_contest", { count: cached.contests.length });
      if (materialize) await materializeContests(cached.contests);
      return {
        contests: sortContests(cached.contests, now),
        fetchedAt: cached.fetchedAt.toISOString(),
        stale: true,
        source: "last_good",
        error: "provider_unavailable",
      };
    }
    return {
      contests: [],
      fetchedAt: now.toISOString(),
      stale: false,
      source: "provider",
      error: results.some((result) => result.status === "rejected")
        ? "provider_unavailable"
        : undefined,
    };
  }
}

export const sportsDataService = new SportsDataService();

export function getSportsSchedule(query?: SportsScheduleQuery) {
  return sportsDataService.getSchedule(query);
}

export function sortContests(contests: Contest[], now = new Date()) {
  const priority = (contest: Contest) => {
    if (["in_progress", "halftime"].includes(contest.state)) return 0;
    if (["delayed", "pregame"].includes(contest.state)) return 1;
    if (
      contest.state === "scheduled" &&
      new Date(contest.scheduledAtUtc).getTime() >= now.getTime()
    )
      return 2;
    if (contest.state === "final") return 3;
    return 4;
  };
  return [...contests].sort(
    (left, right) =>
      priority(left) - priority(right) ||
      new Date(left.scheduledAtUtc).getTime() -
        new Date(right.scheduledAtUtc).getTime(),
  );
}

export function resetSportsScheduleCacheForTests() {
  cache.clear();
}
