import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db/client";
import { materializeContest } from "@/lib/sports/materializer";
import type { Contest } from "@/lib/sports/types";

const run =
  process.env.RUN_DATABASE_TESTS === "true" ? describe : describe.skip;
const providerRef = "espn:mlb:materialization-concurrency-test";

run("sports materialization", () => {
  afterAll(async () => {
    const game = await db.game.findUnique({ where: { providerRef } });
    if (game) await db.game.delete({ where: { id: game.id } });
    await db.$disconnect();
  });

  it("is idempotent under concurrent first materialization", async () => {
    const contest: Contest = {
      id: providerRef,
      provider: "espn",
      providerGameId: "materialization-concurrency-test",
      providerUpdatedAt: "2026-07-28T01:00:00.000Z",
      league: {
        key: "mlb",
        name: "MLB",
        abbreviation: "MLB",
        sportKey: "baseball",
        sportName: "Baseball",
      },
      season: "2026",
      competitionDate: "2026-07-28",
      scheduledAtUtc: "2026-07-28T23:10:00.000Z",
      homeParticipant: {
        providerId: "materialize-home",
        name: "Home Test",
        abbreviation: "HOM",
      },
      awayParticipant: {
        providerId: "materialize-away",
        name: "Away Test",
        abbreviation: "AWY",
      },
      state: "scheduled",
      versions: {
        payload: "fixture-v1",
        schema: "1.0.0",
        adapter: "1.0.0",
      },
    };
    const games = await Promise.all(
      Array.from({ length: 4 }, () => materializeContest(contest)),
    );
    expect(new Set(games.map((game) => game.id))).toHaveLength(1);
    expect(await db.game.count({ where: { providerRef } })).toBe(1);
  });

  it("records the final transition once so archived games stop polling", async () => {
    const base = await db.game.findUniqueOrThrow({ where: { providerRef } });
    const contest: Contest = {
      id: providerRef,
      provider: "espn",
      providerGameId: "materialization-concurrency-test",
      providerUpdatedAt: "2026-07-29T02:00:00.000Z",
      league: {
        key: "mlb",
        name: "MLB",
        abbreviation: "MLB",
        sportKey: "baseball",
        sportName: "Baseball",
      },
      season: "2026",
      competitionDate: "2026-07-28",
      scheduledAtUtc: base.scheduledAt.toISOString(),
      homeParticipant: {
        providerId: "materialize-home",
        name: "Home Test",
        abbreviation: "HOM",
      },
      awayParticipant: {
        providerId: "materialize-away",
        name: "Away Test",
        abbreviation: "AWY",
      },
      state: "final",
      homeScore: 4,
      awayScore: 3,
      versions: {
        payload: "fixture-v2",
        schema: "1.0.0",
        adapter: "1.0.0",
      },
    };
    const first = await materializeContest(contest);
    const endedAt = first.endedAt;
    const second = await materializeContest({
      ...contest,
      providerUpdatedAt: "2026-07-29T02:02:00.000Z",
    });
    expect(second.status).toBe("FINAL");
    expect(second.endedAt).toEqual(endedAt);
  });
});
