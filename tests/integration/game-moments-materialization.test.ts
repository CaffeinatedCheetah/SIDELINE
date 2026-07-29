import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db/client";
import { materializeContest } from "@/lib/sports/materializer";
import {
  archiveGameFlashThreads,
  materializeGameMoments,
} from "@/lib/sports/moments/materializer";
import { normalizeEspnMlbPlays } from "@/lib/sports/moments/providers/espn-mlb";
import { getGameMoments } from "@/lib/sports/moments/read-model";
import { createTake } from "@/lib/takes/create-take";
import type { Contest } from "@/lib/sports/types";
import fixture from "@/tests/fixtures/sports/espn-mlb-plays.json";
import { GET as getMomentsRoute } from "@/app/api/games/[gameId]/moments/route";

const run =
  process.env.RUN_DATABASE_TESTS === "true" ? describe : describe.skip;
const gameProviderRef = "espn:mlb:moment-concurrency-test";
let gameId = "";
let flashThreadId = "";

run("Game Moment materialization", () => {
  afterAll(async () => {
    const game = await db.game.findUnique({
      where: { providerRef: gameProviderRef },
    });
    if (game) await db.game.delete({ where: { id: game.id } });
    await db.$disconnect();
  });

  it("creates exactly one moment and one Flash Thread under concurrent retries", async () => {
    const contest: Contest = {
      id: gameProviderRef,
      provider: "espn",
      providerGameId: "moment-concurrency-test",
      providerUpdatedAt: "2026-07-29T23:10:00.000Z",
      league: {
        key: "mlb",
        name: "MLB",
        abbreviation: "MLB",
        sportKey: "baseball",
        sportName: "Baseball",
      },
      season: "2026",
      competitionDate: "2026-07-29",
      scheduledAtUtc: "2026-07-29T23:10:00.000Z",
      homeParticipant: {
        providerId: "moment-home",
        name: "Home Test",
        abbreviation: "HOM",
      },
      awayParticipant: {
        providerId: "moment-away",
        name: "Away Test",
        abbreviation: "AWY",
      },
      state: "in_progress",
      homeScore: 2,
      awayScore: 1,
      versions: {
        payload: "fixture-v1",
        schema: "1.0.0",
        adapter: "fixture-1.0.0",
      },
    };
    const game = await materializeContest(contest);
    gameId = game.id;
    const moment = normalizeEspnMlbPlays(fixture, { gameProviderRef }).find(
      (candidate) => candidate.providerRef.endsWith(":play-home-run"),
    );
    expect(moment).toBeDefined();

    const results = await Promise.all(
      Array.from({ length: 8 }, () => materializeGameMoments([moment!])),
    );
    expect(new Set(results.map((result) => result[0]?.moment.id))).toHaveLength(
      1,
    );
    expect(
      new Set(results.map((result) => result[0]?.flashThread?.id)),
    ).toHaveLength(1);
    expect(await db.gameMoment.count({ where: { gameId: game.id } })).toBe(1);
    expect(await db.flashThread.count({ where: { gameId: game.id } })).toBe(1);
    flashThreadId = (
      await db.flashThread.findFirstOrThrow({ where: { gameId: game.id } })
    ).id;
  });

  it("allows unauthenticated chronological reads and stores server-derived Take context permanently", async () => {
    const response = await getMomentsRoute(
      new Request(`http://localhost/api/games/${gameId}/moments`),
      { params: Promise.resolve({ gameId }) },
    );
    expect(response.status).toBe(200);

    const author = await db.user.findFirstOrThrow({
      where: { status: "ACTIVE" },
      select: { id: true },
    });
    const take = await createTake({
      authorId: author.id,
      body: "The go-ahead swing changed the entire game.",
      flashThreadId,
    });
    expect(take).toMatchObject({
      gameId,
      flashThreadId,
      gamePeriod: "Bottom 5th",
      homeScoreContext: 2,
      awayScoreContext: 1,
    });

    const finalMoment = normalizeEspnMlbPlays(fixture, {
      gameProviderRef,
    }).find((candidate) => candidate.type === "GAME_END");
    expect(finalMoment).toBeDefined();
    await materializeGameMoments([finalMoment!]);
    await db.game.update({
      where: { id: gameId },
      data: { status: "FINAL", endedAt: new Date() },
    });
    await archiveGameFlashThreads(gameId);

    const timeline = await getGameMoments(gameId);
    expect(timeline?.map((moment) => moment.type)).toEqual([
      "LEAD_CHANGE",
      "GAME_END",
    ]);
    expect(
      await db.flashThread.count({
        where: { gameId, status: "ARCHIVED" },
      }),
    ).toBe(2);
    expect(await db.take.count({ where: { id: take.id, flashThreadId } })).toBe(
      1,
    );
    await expect(
      createTake({
        authorId: author.id,
        body: "Archived rooms must reject new Takes.",
        flashThreadId,
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
