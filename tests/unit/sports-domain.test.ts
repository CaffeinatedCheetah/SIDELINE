import { describe, expect, it } from "vitest";

import { getSupportedLeague } from "@/lib/sports/leagues";
import {
  normalizeEspnEvent,
  normalizeEspnStatus,
} from "@/lib/sports/providers/espn";
import { sortContests } from "@/lib/sports/service";

const mlb = getSupportedLeague("mlb")!;

describe("sports domain normalization", () => {
  it.each([
    [{ state: "pre" }, "scheduled"],
    [{ state: "in", detail: "Top 7th" }, "in_progress"],
    [{ state: "in", detail: "Halftime" }, "halftime"],
    [{ name: "STATUS_DELAYED", detail: "Weather Delay" }, "delayed"],
    [{ name: "STATUS_POSTPONED" }, "postponed"],
    [{ name: "STATUS_SUSPENDED" }, "suspended"],
    [{ name: "STATUS_CANCELED" }, "cancelled"],
    [{ state: "post", completed: true }, "final"],
  ])("maps provider status once: %o", (provider, expected) => {
    expect(normalizeEspnStatus(provider)).toBe(expected);
  });

  it("normalizes a provider contest with version metadata and UTC time", () => {
    const contest = normalizeEspnEvent(
      {
        id: "401234",
        date: "2026-07-28T00:10:00-04:00",
        season: { year: 2026 },
        competitions: [
          {
            date: "2026-07-28T00:10:00-04:00",
            competitors: [
              {
                homeAway: "home",
                score: "3",
                team: {
                  id: "10",
                  displayName: "Detroit Tigers",
                  abbreviation: "DET",
                  logo: "https://example.test/det.png",
                },
              },
              {
                homeAway: "away",
                score: "2",
                team: {
                  id: "20",
                  displayName: "Chicago Cubs",
                  abbreviation: "CHC",
                },
              },
            ],
            status: {
              type: { state: "in", detail: "Top 7th" },
              period: 7,
            },
            venue: { fullName: "Comerica Park" },
            broadcasts: [{ names: ["ESPN"] }],
          },
        ],
      },
      mlb,
      new Date("2026-07-28T04:11:00Z"),
    );
    expect(contest).toMatchObject({
      id: "espn:mlb:401234",
      scheduledAtUtc: "2026-07-28T04:10:00.000Z",
      state: "in_progress",
      homeParticipant: { name: "Detroit Tigers" },
      venue: "Comerica Park",
      broadcast: "ESPN",
      versions: {
        payload: "site-v2-scoreboard",
        schema: "1.0.0",
        adapter: "1.0.0",
      },
    });
  });

  it("curates live, upcoming, and final contests in product order", () => {
    const base = normalizeEspnEvent(
      {
        id: "base",
        date: "2026-07-28T02:00:00Z",
        competitions: [
          {
            competitors: [
              { homeAway: "home", team: { id: "1", abbreviation: "A" } },
              { homeAway: "away", team: { id: "2", abbreviation: "B" } },
            ],
            status: { type: { state: "pre" } },
          },
        ],
      },
      mlb,
    )!;
    const order = sortContests(
      [
        { ...base, id: "final", state: "final" },
        { ...base, id: "upcoming", state: "scheduled" },
        { ...base, id: "live", state: "in_progress" },
      ],
      new Date("2026-07-28T01:00:00Z"),
    ).map((contest) => contest.id);
    expect(order).toEqual(["live", "upcoming", "final"]);
  });
});
