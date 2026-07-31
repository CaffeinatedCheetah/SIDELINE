import "server-only";

import { db } from "@/lib/db/client";
import {
  GAME_RECAP_CONTEXT_VERSION,
  GAME_RECAP_PROMPT_VERSION,
} from "@/lib/ai/prompts/game-recap-v1";
import { GAME_RECAP_SCHEMA_VERSION } from "@/lib/ai/schemas/game-recap";

export const POSTGAME_COMMUNITY_WINDOW_MS = 2 * 60 * 60 * 1000;

export type GameRecapContext = Awaited<
  ReturnType<typeof retrieveGameRecapContext>
>;

export async function retrieveGameRecapContext(gameId: string) {
  const game = await db.game.findUnique({
    where: { id: gameId },
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      endedAt: true,
      homeScore: true,
      awayScore: true,
      period: true,
      updatedAt: true,
      venue: true,
      broadcast: true,
      league: {
        select: {
          key: true,
          name: true,
          abbreviation: true,
          sport: { select: { key: true, name: true } },
        },
      },
      homeTeam: { select: { id: true, name: true, abbreviation: true } },
      awayTeam: { select: { id: true, name: true, abbreviation: true } },
      moments: {
        orderBy: [{ importance: "desc" }, { occurredAt: "asc" }],
        take: 12,
        select: {
          id: true,
          type: true,
          title: true,
          description: true,
          period: true,
          clock: true,
          homeScore: true,
          awayScore: true,
          importance: true,
          occurredAt: true,
          updatedAt: true,
          provider: true,
        },
      },
      flashThreads: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          takes: {
            where: { status: "ACTIVE", deletedAt: null },
            orderBy: { createdAt: "desc" },
            take: 4,
            select: {
              id: true,
              body: true,
              createdAt: true,
              _count: { select: { reactions: true, replies: true } },
            },
          },
        },
      },
      debates: {
        where: { status: { in: ["OPEN", "LOCKED", "ARCHIVED"] } },
        orderBy: { createdAt: "desc" },
        take: 4,
        select: {
          id: true,
          title: true,
          prompt: true,
          createdAt: true,
          _count: { select: { votes: true, takes: true } },
        },
      },
      takes: {
        where: {
          status: "ACTIVE",
          deletedAt: null,
          parentId: null,
        },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          body: true,
          createdAt: true,
          _count: { select: { reactions: true, replies: true } },
        },
      },
    },
  });
  if (!game) return null;

  const sourceManifest = [
    { type: "GAME", id: game.id, occurredAt: game.updatedAt.toISOString() },
    ...game.moments.map((moment) => ({
      type: "GAME_MOMENT",
      id: moment.id,
      occurredAt: moment.occurredAt.toISOString(),
    })),
    ...game.flashThreads.map((thread) => ({
      type: "FLASH_THREAD",
      id: thread.id,
      occurredAt: thread.createdAt.toISOString(),
    })),
    ...game.takes.map((take) => ({
      type: "TAKE",
      id: take.id,
      occurredAt: take.createdAt.toISOString(),
    })),
    ...game.debates.map((debate) => ({
      type: "DEBATE",
      id: debate.id,
      occurredAt: debate.createdAt.toISOString(),
    })),
  ];

  return {
    contextVersion: GAME_RECAP_CONTEXT_VERSION,
    generatedForGameId: game.id,
    officialFacts: {
      gameId: game.id,
      league: game.league,
      scheduledAt: game.scheduledAt.toISOString(),
      endedAt: game.endedAt?.toISOString() ?? null,
      state: game.status,
      finalScore: {
        away: game.awayScore,
        home: game.homeScore,
      },
      awayTeam: game.awayTeam,
      homeTeam: game.homeTeam,
      finalPhase: game.period,
      venue: game.venue,
      broadcast: game.broadcast,
    },
    moments: game.moments.map((moment) => ({
      ...moment,
      occurredAt: moment.occurredAt.toISOString(),
      updatedAt: moment.updatedAt.toISOString(),
      verified: true,
    })),
    community: {
      threads: game.flashThreads.map((thread) => ({
        ...thread,
        createdAt: thread.createdAt.toISOString(),
        takes: thread.takes.map((take) => ({
          ...take,
          createdAt: take.createdAt.toISOString(),
        })),
      })),
      takes: game.takes.map((take) => ({
        ...take,
        createdAt: take.createdAt.toISOString(),
      })),
      debates: game.debates.map((debate) => ({
        ...debate,
        createdAt: debate.createdAt.toISOString(),
      })),
    },
    sourceManifest,
    versions: {
      prompt: GAME_RECAP_PROMPT_VERSION,
      schema: GAME_RECAP_SCHEMA_VERSION,
      context: GAME_RECAP_CONTEXT_VERSION,
    },
  };
}
