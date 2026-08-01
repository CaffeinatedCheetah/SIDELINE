import { describe, expect, it } from "vitest";
import { predictionStatus, templatesForGame } from "@/lib/services/live-predictions";

describe("live prediction templates", () => {
  it("only surfaces sport-aware templates during live play", () => {
    expect(templatesForGame({ sportKey: "football", home: "Home", away: "Away", status: "SCHEDULED" })).toEqual([]);
    expect(templatesForGame({ sportKey: "football", home: "Home", away: "Away", status: "LIVE" })[0]?.options).toEqual(["Away", "Home", "No more scoring"]);
    expect(templatesForGame({ sportKey: "baseball", home: "Home", away: "Away", status: "LIVE" })[0]?.question).toContain("scoreless");
  });
  it("locks deterministically at the exact boundary", () => {
    const lockAt = new Date("2026-07-31T12:00:00.000Z");
    expect(predictionStatus(lockAt, new Date("2026-07-31T11:59:59.999Z"))).toBe("OPEN");
    expect(predictionStatus(lockAt, lockAt)).toBe("LOCKED");
  });
});