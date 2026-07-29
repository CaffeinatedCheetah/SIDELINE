import fs from "node:fs/promises";
import path from "node:path";

import {
  fetchEspnMlbMoments,
  normalizeEspnMlbPlays,
} from "@/lib/sports/moments/providers/espn-mlb";
import type { CanonicalGameMoment } from "@/lib/sports/moments/types";
import { recordSportsMetric } from "@/lib/sports/observability";

export interface GameMomentProviderAdapter {
  readonly provider: string;
  fetchMoments(query: {
    leagueKey: string;
    providerGameId: string;
    gameProviderRef: string;
  }): Promise<CanonicalGameMoment[]>;
}

const espnMomentAdapter: GameMomentProviderAdapter = {
  provider: "espn",
  async fetchMoments({ leagueKey, providerGameId, gameProviderRef }) {
    if (leagueKey !== "mlb") return [];
    return fetchEspnMlbMoments(providerGameId, { gameProviderRef });
  },
};

function fixtureMomentAdapter(fixturePath: string): GameMomentProviderAdapter {
  return {
    provider: "espn",
    async fetchMoments({ leagueKey, gameProviderRef }) {
      if (leagueKey !== "mlb") return [];
      const payload = JSON.parse(
        await fs.readFile(path.resolve(process.cwd(), fixturePath), "utf8"),
      );
      return normalizeEspnMlbPlays(payload, { gameProviderRef });
    },
  };
}

export class SportsMomentService {
  constructor(
    private readonly adapters: GameMomentProviderAdapter[] = [
      process.env.SPORTS_MOMENTS_FIXTURE_PATH
        ? fixtureMomentAdapter(process.env.SPORTS_MOMENTS_FIXTURE_PATH)
        : espnMomentAdapter,
    ],
  ) {}

  async getMoments(query: {
    provider: string;
    leagueKey: string;
    providerGameId: string;
    gameProviderRef: string;
  }) {
    const adapter = this.adapters.find(
      (candidate) => candidate.provider === query.provider,
    );
    if (!adapter) return [];
    const startedAt = Date.now();
    try {
      const moments = await adapter.fetchMoments(query);
      recordSportsMetric("moment_provider_request", {
        league: query.leagueKey,
        durationMs: Date.now() - startedAt,
        count: moments.length,
        metadata: { provider: query.provider, ok: true },
      });
      return moments;
    } catch (error) {
      recordSportsMetric("moment_provider_request", {
        league: query.leagueKey,
        durationMs: Date.now() - startedAt,
        metadata: {
          provider: query.provider,
          ok: false,
          error: error instanceof Error ? error.name : "unknown",
        },
      });
      throw error;
    }
  }
}

export const sportsMomentService = new SportsMomentService();
