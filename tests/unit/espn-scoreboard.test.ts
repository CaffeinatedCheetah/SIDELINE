import { describe, expect, it } from "vitest";
import { sortByLiveFirst, type EspnGame } from "@/lib/sports/espn";

function game(overrides: Partial<EspnGame>): EspnGame {
  return {
    id: "espn-nba-1",
    tab: "NBA",
    leagueLabel: "NBA",
    homeTeam: { name: "Home", abbreviation: "HOM" },
    awayTeam: { name: "Away", abbreviation: "AWY" },
    homeScore: null,
    awayScore: null,
    status: "SCHEDULED",
    statusDetail: "",
    scheduledAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("sortByLiveFirst", () => {
  it("puts LIVE games ahead of SCHEDULED and FINAL", () => {
    const scheduled = game({ id: "a", status: "SCHEDULED" });
    const live = game({ id: "b", status: "LIVE" });
    const final = game({ id: "c", status: "FINAL" });
    const sorted = sortByLiveFirst([scheduled, final, live]);
    expect(sorted.map((g) => g.id)).toEqual(["b", "a", "c"]);
  });

  it("breaks ties within the same status by earliest start time", () => {
    const later = game({
      id: "later",
      status: "SCHEDULED",
      scheduledAt: "2026-01-01T20:00:00Z",
    });
    const earlier = game({
      id: "earlier",
      status: "SCHEDULED",
      scheduledAt: "2026-01-01T10:00:00Z",
    });
    const sorted = sortByLiveFirst([later, earlier]);
    expect(sorted.map((g) => g.id)).toEqual(["earlier", "later"]);
  });

  it("does not mutate the input array", () => {
    const input = [game({ id: "a", status: "FINAL" }), game({ id: "b", status: "LIVE" })];
    const copy = [...input];
    sortByLiveFirst(input);
    expect(input).toEqual(copy);
  });
});
