import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  userFindFirst: vi.fn(),
  takeFindMany: vi.fn(),
  debateFindFirst: vi.fn(),
  gameFindMany: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    user: { findFirst: mocks.userFindFirst },
    take: { findMany: mocks.takeFindMany },
    debate: { findFirst: mocks.debateFindFirst },
    game: { findMany: mocks.gameFindMany },
  },
}));

import { getScoutHighlights } from "@/lib/db/scout-highlights";

describe("Scout highlights", () => {
  it("returns truthful empty state when Scout content is unavailable", async () => {
    mocks.userFindFirst.mockResolvedValue(null);
    await expect(getScoutHighlights()).resolves.toEqual({
      topStory: null,
      trendingTopics: [],
      suggestedDebate: null,
      trendingMatchup: null,
      failed: false,
    });
  });

  it("surfaces persisted Scout content without regenerating it", async () => {
    mocks.userFindFirst.mockResolvedValue({ id: "scout-user" });
    mocks.takeFindMany.mockResolvedValue([
      {
        id: "take-1",
        body: "First topic",
        createdAt: new Date("2026-07-31T00:10:00Z"),
        _count: { reactions: 2, replies: 1 },
      },
      {
        id: "take-2",
        body: "Second topic with higher engagement",
        createdAt: new Date("2026-07-31T00:20:00Z"),
        _count: { reactions: 4, replies: 3 },
      },
    ]);
    mocks.debateFindFirst.mockResolvedValue({
      id: "debate-1",
      slug: "debate-1",
      title: "Who owns the matchup?",
      prompt: "Use real football logic.",
      createdAt: new Date("2026-07-31T00:00:00Z"),
      _count: { comments: 6 },
      options: [
        { label: "Team A", _count: { votes: 5 } },
        { label: "Team B", _count: { votes: 4 } },
      ],
    });
    mocks.gameFindMany.mockResolvedValue([
      {
        id: "game-1",
        status: "LIVE",
        statusDetail: "3rd 08:42",
        scheduledAt: new Date("2026-07-31T01:00:00Z"),
        broadcast: "FOX",
        homeScore: 17,
        awayScore: 14,
        league: { abbreviation: "NFL", key: "nfl" },
        homeTeam: { name: "Lions", abbreviation: "DET", logoUrl: null },
        awayTeam: { name: "Bears", abbreviation: "CHI", logoUrl: null },
        _count: { takes: 12, follows: 4 },
      },
    ]);

    await expect(getScoutHighlights()).resolves.toMatchObject({
      topStory: {
        id: "take-2",
        body: "Second topic with higher engagement",
      },
      trendingTopics: [
        { id: "take-2" },
        { id: "take-1" },
      ],
      suggestedDebate: {
        slug: "debate-1",
        title: "Who owns the matchup?",
        replies: 6,
      },
      trendingMatchup: {
        id: "game-1",
        status: "LIVE",
        statusText: "3rd 08:42",
      },
      failed: false,
    });
  });
});
