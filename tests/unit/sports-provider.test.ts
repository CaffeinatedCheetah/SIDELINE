import { describe, expect, it } from "vitest";
import { deriveStatus } from "@/lib/sports/balldontlie";

describe("BallDontLie status mapping", () => {
  it("maps a postponed game regardless of status text", () => {
    expect(deriveStatus("7:00 pm ET", null, true)).toBe("POSTPONED");
  });
  it("maps a not-yet-started game to SCHEDULED", () => {
    expect(deriveStatus("7:00 pm ET", null, false)).toBe("SCHEDULED");
  });
  it("maps a completed game to FINAL even with a nonzero period", () => {
    expect(deriveStatus("Final", 4, false)).toBe("FINAL");
  });
  it("maps an in-progress period to LIVE", () => {
    expect(deriveStatus("3rd Qtr", 3, false)).toBe("LIVE");
  });
});
