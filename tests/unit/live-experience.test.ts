import { beforeEach, describe, expect, it, vi } from "vitest";

import { getGameLiveExperience } from "@/lib/games/live-experience";

const { dbMock, getGameMoments, getGameFlashThreads } = vi.hoisted(() => ({
  dbMock: {
    game: { findUnique: vi.fn() },
    prediction: { findMany: vi.fn() },
    take: { findMany: vi.fn() },
    fanScoreEvent: { findMany: vi.fn() },
  },
  getGameMoments: vi.fn(),
  getGameFlashThreads: vi.fn(),
}));

vi.mock("@/lib/sports/moments/read-model", () => ({
  getGameMoments: (...args: unknown[]) => getGameMoments(...args),
  getGameFlashThreads: (...args: unknown[]) => getGameFlashThreads(...args),
}));

vi.mock("@/lib/db/client", () => ({
  db: dbMock,
}));

describe("live experience read model", () => {
  beforeEach(() => {
    dbMock.game.findUnique.mockReset();
    dbMock.prediction.findMany.mockReset();
    dbMock.take.findMany.mockReset();
    dbMock.fanScoreEvent.findMany.mockReset();
    getGameMoments.mockReset();
    getGameFlashThreads.mockReset();
  });

  it("merges thread, moment, prediction, take, and milestone activity", async () => {
    dbMock.game.findUnique.mockResolvedValue({
      id: "game-1",
      status: "LIVE",
      league: { key: "mlb" },
      homeTeam: { name: "Home", abbreviation: "H" },
      awayTeam: { name: "Away", abbreviation: "A" },
    });
    getGameMoments.mockResolvedValue([
      {
        id: "moment-1",
        type: "SCORE",
        title: "Home run",
        description: "A real play.",
        period: "Bottom 7th",
        clock: null,
        homeScore: 4,
        awayScore: 3,
        importance: 90,
        occurredAt: new Date("2026-07-31T00:20:00.000Z"),
        flashThread: null,
      },
    ]);
    getGameFlashThreads.mockResolvedValue([
      {
        id: "thread-1",
        title: "Home run discussion",
        status: "ACTIVE",
        createdAt: new Date("2026-07-31T00:21:00.000Z"),
        moment: {
          id: "moment-1",
          type: "SCORE",
          title: "Home run",
          description: "A real play.",
          period: "Bottom 7th",
          clock: null,
          homeScore: 4,
          awayScore: 3,
          importance: 90,
          occurredAt: new Date("2026-07-31T00:20:00.000Z"),
        },
        takes: [],
        takeCount: 2,
        reactionCount: 5,
        replyCount: 1,
      },
    ]);
    dbMock.prediction.findMany.mockResolvedValue([
      {
        id: "prediction-1",
        selection: "home",
        status: "OPEN",
        locksAt: new Date("2026-07-31T00:30:00.000Z"),
        submittedAt: new Date("2026-07-31T00:22:00.000Z"),
        result: null,
        user: { handle: "fan", displayName: "Fan", image: null },
      },
    ]);
    dbMock.take.findMany.mockResolvedValue([
      {
        id: "take-1",
        body: "Great finish.",
        createdAt: new Date("2026-07-31T00:23:00.000Z"),
        author: { handle: "fan", displayName: "Fan", image: null },
        _count: { reactions: 2, replies: 1, votes: 3 },
      },
    ]);
    dbMock.fanScoreEvent.findMany.mockResolvedValue([
      {
        id: "event-1",
        points: 10,
        reason: "Posted a substantive take",
        occurredAt: new Date("2026-07-31T00:24:00.000Z"),
        user: { handle: "fan", displayName: "Fan" },
      },
    ]);

    const experience = await getGameLiveExperience("game-1");

    expect(experience?.activePredictionCount).toBe(1);
    expect(experience?.flashThreadCount).toBe(1);
    expect(experience?.activity.map((item) => item.kind)).toEqual([
      "milestone",
      "take",
      "prediction",
      "thread",
      "moment",
    ]);
    expect(experience?.activity[0]?.title).toContain("earned 10 XP");
  });

  it("returns null for a missing game", async () => {
    dbMock.game.findUnique.mockResolvedValue(null);
    await expect(getGameLiveExperience("missing")).resolves.toBeNull();
  });
});
