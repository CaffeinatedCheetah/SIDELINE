import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  getSportsSchedule: vi.fn(),
  materializeContests: vi.fn(),
  recordSportsMetric: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  db: { game: { findMany: mocks.findMany } },
}));
vi.mock("@/lib/sports/service", () => ({
  getSportsSchedule: mocks.getSportsSchedule,
}));
vi.mock("@/lib/sports/materializer", () => ({
  materializeContests: mocks.materializeContests,
}));
vi.mock("@/lib/sports/observability", () => ({
  recordSportsMetric: mocks.recordSportsMetric,
}));

import { getSportsGameDirectory } from "@/lib/sports/read-model";

describe("sports read-model resilience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSportsSchedule.mockResolvedValue({
      contests: [],
      fetchedAt: "2026-07-28T22:00:00.000Z",
      stale: false,
      source: "provider",
    });
  });

  it("returns a truthful provider error instead of crashing when the database schema is unavailable", async () => {
    mocks.findMany.mockRejectedValue(new Error("column does not exist"));

    await expect(getSportsGameDirectory()).resolves.toEqual({
      games: [],
      providerError: true,
      stale: false,
      source: "database",
      fetchedAt: "2026-07-28T22:00:00.000Z",
    });
    expect(mocks.recordSportsMetric).toHaveBeenCalledWith(
      "materialization_failure",
      expect.objectContaining({
        metadata: expect.objectContaining({
          operation: "database_fallback",
        }),
      }),
    );
  });
});
