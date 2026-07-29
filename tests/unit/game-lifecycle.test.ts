import { describe, expect, it } from "vitest";

import {
  lifecycleRefreshIntervalMs,
  phaseFromProviderState,
} from "@/lib/sports/game-lifecycle";
import { serverRefreshIntervalMs } from "@/lib/sports/lifecycle-sync";

describe("canonical game lifecycle", () => {
  it.each([
    ["scheduled", "SCHEDULED"],
    ["pregame", "PREGAME"],
    ["delayed", "PREGAME"],
    ["in_progress", "LIVE"],
    ["suspended", "LIVE"],
    ["halftime", "HALFTIME"],
    ["final", "FINAL"],
    ["postponed", "POSTPONED"],
    ["cancelled", "CANCELLED"],
  ] as const)("maps provider state %s once to %s", (state, phase) => {
    expect(phaseFromProviderState(state)).toBe(phase);
  });

  it("uses lifecycle-aware browser refresh intervals", () => {
    const now = new Date("2026-07-29T00:00:00.000Z");
    expect(
      lifecycleRefreshIntervalMs(
        { phase: "LIVE", startsAt: "2026-07-28T23:00:00.000Z" },
        now,
      ),
    ).toBe(20_000);
    expect(
      lifecycleRefreshIntervalMs(
        { phase: "SCHEDULED", startsAt: "2026-07-29T04:00:00.000Z" },
        now,
      ),
    ).toBe(5 * 60_000);
    expect(
      lifecycleRefreshIntervalMs(
        { phase: "CANCELLED", startsAt: "2026-07-29T04:00:00.000Z" },
        now,
      ),
    ).toBeNull();
  });

  it("accelerates server synchronization for live games and retires archives", () => {
    const now = new Date("2026-07-29T00:00:00.000Z");
    expect(
      serverRefreshIntervalMs({
        status: "LIVE",
        scheduledAt: new Date("2026-07-28T23:00:00.000Z"),
        endedAt: null,
        now,
      }),
    ).toBe(20_000);
    expect(
      serverRefreshIntervalMs({
        status: "FINAL",
        scheduledAt: new Date("2026-07-28T20:00:00.000Z"),
        endedAt: new Date("2026-07-28T23:50:00.000Z"),
        now,
      }),
    ).toBe(2 * 60_000);
    expect(
      serverRefreshIntervalMs({
        status: "FINAL",
        scheduledAt: new Date("2026-07-27T20:00:00.000Z"),
        endedAt: new Date("2026-07-27T23:00:00.000Z"),
        now,
      }),
    ).toBeNull();
  });
});
