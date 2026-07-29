import fixture from "@/tests/fixtures/sports/espn-mlb-plays.json";
import { describe, expect, it } from "vitest";

import { normalizeEspnMlbPlays } from "@/lib/sports/moments/providers/espn-mlb";
import { shouldCreateFlashThread } from "@/lib/sports/moments/types";

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
});
