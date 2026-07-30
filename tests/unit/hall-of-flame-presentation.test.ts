import { describe, expect, it } from "vitest";

import { sortHallEntries } from "@/lib/hall-of-flame/presentation";

const entries = [
  {
    id: "rank-one",
    rank: 1,
    take: {
      createdAt: new Date("2026-07-28T12:00:00Z"),
      _count: { reactions: 2, comments: 4, replies: 1 },
    },
  },
  {
    id: "most-reacted",
    rank: 2,
    take: {
      createdAt: new Date("2026-07-30T12:00:00Z"),
      _count: { reactions: 12, comments: 1, replies: 0 },
    },
  },
  {
    id: "most-discussed",
    rank: 3,
    take: {
      createdAt: new Date("2026-07-29T12:00:00Z"),
      _count: { reactions: 4, comments: 8, replies: 3 },
    },
  },
];

describe("Hall of Flame presentation filters", () => {
  it("keeps official rank as the default order", () => {
    expect(sortHallEntries(entries, "ranked").map((entry) => entry.id)).toEqual(
      ["rank-one", "most-reacted", "most-discussed"],
    );
  });

  it("uses real reaction, discussion, and recency signals", () => {
    expect(sortHallEntries(entries, "reacted")[0]?.id).toBe("most-reacted");
    expect(sortHallEntries(entries, "discussed")[0]?.id).toBe("most-discussed");
    expect(sortHallEntries(entries, "rising")[0]?.id).toBe("most-reacted");
  });
});
