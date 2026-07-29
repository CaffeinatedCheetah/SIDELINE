import { Prisma } from "@prisma/client";

import { db } from "@/lib/db/client";
import type { CanonicalGameMoment } from "@/lib/sports/moments/types";
import { shouldCreateFlashThread } from "@/lib/sports/moments/types";
import { recordSportsMetric } from "@/lib/sports/observability";

export async function materializeGameMoments(
  moments: CanonicalGameMoment[],
  { maxAttempts = 8 }: { maxAttempts?: number } = {},
) {
  if (!moments.length) return [];
  const gameProviderRef = moments[0]?.gameProviderRef;
  if (
    !gameProviderRef ||
    moments.some((moment) => moment.gameProviderRef !== gameProviderRef)
  )
    throw new Error(
      "A moment batch must belong to exactly one canonical game.",
    );

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await db.$transaction(
        async (tx) => {
          const game = await tx.game.findUnique({
            where: { providerRef: gameProviderRef },
            select: { id: true },
          });
          if (!game)
            throw new Error(
              `Canonical game not found for provider ref ${gameProviderRef}.`,
            );

          const materialized = [];
          for (const moment of moments) {
            const gameMoment = await tx.gameMoment.upsert({
              where: {
                provider_providerRef: {
                  provider: moment.provider,
                  providerRef: moment.providerRef,
                },
              },
              create: {
                gameId: game.id,
                provider: moment.provider,
                providerRef: moment.providerRef,
                type: moment.type,
                title: moment.title,
                description: moment.description,
                period: moment.period,
                clock: moment.clock,
                homeScore: moment.homeScore,
                awayScore: moment.awayScore,
                importance: moment.importance,
                occurredAt: moment.occurredAt,
                metadata: moment.metadata ?? Prisma.JsonNull,
              },
              update: {
                type: moment.type,
                title: moment.title,
                description: moment.description,
                period: moment.period,
                clock: moment.clock,
                homeScore: moment.homeScore,
                awayScore: moment.awayScore,
                importance: moment.importance,
                occurredAt: moment.occurredAt,
                metadata: moment.metadata ?? Prisma.JsonNull,
              },
            });
            const flashThread = shouldCreateFlashThread(moment)
              ? await tx.flashThread.upsert({
                  where: { momentId: gameMoment.id },
                  create: {
                    gameId: game.id,
                    momentId: gameMoment.id,
                    title: moment.title,
                  },
                  update: { title: moment.title },
                })
              : null;
            materialized.push({ moment: gameMoment, flashThread });
          }
          return materialized;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      );
      recordSportsMetric("moment_synchronized", {
        count: result.length,
        metadata: { provider: moments[0]?.provider, attempt },
      });
      return result;
    } catch (error) {
      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2002", "P2034"].includes(error.code);
      if (retryable && attempt < maxAttempts) {
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(200, 10 * 2 ** (attempt - 1))),
        );
        continue;
      }
      recordSportsMetric("moment_materialization_failure", {
        metadata: {
          provider: moments[0]?.provider,
          attempt,
          retryable,
          error: error instanceof Error ? error.name : "unknown",
        },
      });
      throw error;
    }
  }
  throw new Error("Game Moment materialization exhausted retries.");
}

export async function archiveGameFlashThreads(
  gameId: string,
  archivedAt = new Date(),
) {
  return db.flashThread.updateMany({
    where: { gameId, status: "ACTIVE" },
    data: { status: "ARCHIVED", archivedAt },
  });
}
