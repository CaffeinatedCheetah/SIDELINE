import { HallPeriod } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { hallPeriodStartUtc } from "@/lib/services/hall-of-flame-job";

describe("Hall of Flame UTC period boundaries", () => {
  const now = new Date("2026-07-27T23:30:00-07:00");
  it("uses UTC daily boundaries", () => {
    expect(hallPeriodStartUtc(HallPeriod.DAILY, now).toISOString()).toBe(
      "2026-07-28T00:00:00.000Z",
    );
  });
  it("uses Monday UTC for weekly boundaries", () => {
    expect(hallPeriodStartUtc(HallPeriod.WEEKLY, now).toISOString()).toBe(
      "2026-07-27T00:00:00.000Z",
    );
  });
  it("uses UTC month boundaries", () => {
    expect(hallPeriodStartUtc(HallPeriod.MONTHLY, now).toISOString()).toBe(
      "2026-07-01T00:00:00.000Z",
    );
  });
});
