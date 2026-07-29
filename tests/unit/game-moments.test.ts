import fixture from "@/tests/fixtures/sports/espn-mlb-plays.json";
import { describe, expect, it, vi } from "vitest";

import {
  fetchEspnMlbMoments,
  normalizeEspnMlbPlays,
} from "@/lib/sports/moments/providers/espn-mlb";
import { shouldCreateFlashThread } from "@/lib/sports/moments/types";
import {
  SportsMomentService,
  type GameMomentProviderAdapter,
} from "@/lib/sports/moments/service";

describe("MLB Game Moment normalization", () => {
  it("normalizes only high-confidence provider plays", () => {
    const moments = normalizeEspnMlbPlays(fixture);
    expect(moments.map((moment) => moment.providerRef)).not.toContain(
      "mlb-moments-fixture-1:play-routine-out",
    );
    expect(moments).toHaveLength(5);
    expect(moments.every((moment) => moment.provider === "espn")).toBe(true);
  });

  it("uses one primary moment and supplementary classifications for a go-ahead home run", () => {
    const moment = normalizeEspnMlbPlays(fixture).find(
      (candidate) =>
        candidate.providerRef === "mlb-moments-fixture-1:play-home-run",
    );
    expect(moment).toMatchObject({
      type: "LEAD_CHANGE",
      homeScore: 2,
      awayScore: 1,
      period: "Bottom 5th",
      importance: 90,
    });
    expect(moment?.metadata?.classifications).toEqual([
      "SCORE",
      "HOME_RUN",
      "LEAD_CHANGE",
    ]);
    expect(moment && shouldCreateFlashThread(moment)).toBe(true);
  });

  it("ignores unknown, incomplete, and malformed provider events", () => {
    expect(
      normalizeEspnMlbPlays({
        header: { id: "unknowns" },
        plays: [
          {
            id: "routine",
            text: "Routine called strike.",
            wallclock: "2026-07-29T23:11:00.000Z",
          },
          {
            id: "missing-time",
            text: "A run scores.",
            scoringPlay: true,
          },
        ],
      }),
    ).toEqual([]);
  });

  it("does not create threads for routine period markers below the threshold", () => {
    const periodEnd = normalizeEspnMlbPlays(fixture).find(
      (moment) => moment.type === "PERIOD_END",
    );
    expect(periodEnd).toBeDefined();
    expect(periodEnd && shouldCreateFlashThread(periodEnd)).toBe(false);
  });

  it("fetches real provider play-by-play through the MLB adapter boundary", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify(fixture), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const moments = await fetchEspnMlbMoments("mlb-moments-fixture-1", {
      fetcher,
    });
    expect(fetcher).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: "/apis/site/v2/sports/baseball/mlb/summary",
        search: "?event=mlb-moments-fixture-1",
      }),
      expect.objectContaining({ headers: { Accept: "application/json" } }),
    );
    expect(moments.some((moment) => moment.type === "LEAD_CHANGE")).toBe(true);
  });

  it("keeps provider selection behind the provider-neutral moment service", async () => {
    const adapter: GameMomentProviderAdapter = {
      provider: "fixture-provider",
      fetchMoments: vi.fn(async () => []),
    };
    const service = new SportsMomentService([adapter]);
    await expect(
      service.getMoments({
        provider: "fixture-provider",
        leagueKey: "mlb",
        providerGameId: "game-1",
        gameProviderRef: "fixture-provider:mlb:game-1",
      }),
    ).resolves.toEqual([]);
    expect(adapter.fetchMoments).toHaveBeenCalledOnce();
  });
});
