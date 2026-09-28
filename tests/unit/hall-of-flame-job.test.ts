import { HallPeriod, type PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  generateHallOfFlame,
  hallPeriodStartUtc,
} from "@/lib/services/hall-of-flame-job";

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

it("ranks candidates across pages and persists only the best hundred", async () => {
  const take = (id: string, body: string) => ({
    id,
    body,
    _count: { reactions: 0, comments: 0 },
  });
  const firstPage = Array.from({ length: 1000 }, (_, i) =>
    take(`a${i}`, "short"),
  );
  const findMany = vi
    .fn()
    .mockResolvedValueOnce(firstPage)
    .mockResolvedValueOnce([take("winner", "x".repeat(400))])
    .mockResolvedValueOnce([]);
  const createMany = vi.fn().mockResolvedValue({ count: 100 });
  const tx = {
    hallOfFlameEntry: {
      deleteMany: vi.fn(),
      createMany,
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
  const client = {
    take: { findMany },
    report: { groupBy: vi.fn().mockResolvedValue([]) },
    $transaction: (work: (transaction: typeof tx) => Promise<unknown>) =>
      work(tx),
  } as unknown as PrismaClient;
  await generateHallOfFlame(client, HallPeriod.ALL_TIME);
  expect(findMany.mock.calls[1][0]).toMatchObject({
    cursor: { id: "a999" },
    skip: 1,
    take: 1000,
  });
  const entries = createMany.mock.calls[0][0].data;
  expect(entries).toHaveLength(100);
  expect(entries[0]).toMatchObject({ takeId: "winner", rank: 1, score: 70 });
});
