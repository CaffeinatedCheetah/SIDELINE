import { Prisma, type PrismaClient } from "@prisma/client";

import { awardBadge } from "@/lib/badges/service";
import { FAN_SCORE_POINTS } from "@/lib/scoring/fan-score";

export async function resolveGamePredictions(
  db: PrismaClient,
  gameId: string,
  now = new Date(),
) {
  const game = await db.game.findUnique({
    where: { id: gameId },
    include: { predictions: { include: { result: true } } },
  });
  if (!game) throw new Error("GAME_NOT_FOUND");
  if (!["FINAL", "POSTPONED", "CANCELED"].includes(game.status))
    return { resolved: 0, skipped: game.predictions.length };

  const voided =
    game.status !== "FINAL" ||
    game.homeScore === null ||
    game.awayScore === null ||
    game.homeScore === game.awayScore;
  const winningSelection = voided
    ? null
    : game.homeScore! > game.awayScore!
      ? "home"
      : "away";
  let resolved = 0;
  for (const prediction of game.predictions) {
    if (prediction.result) continue;
    await db.$transaction(
      async (transaction) => {
        const outcome = voided
          ? "VOID"
          : prediction.selection === winningSelection
            ? "CORRECT"
            : "INCORRECT";
        await transaction.predictionResult.create({
          data: {
            predictionId: prediction.id,
            outcome,
            resolvedSelection: winningSelection,
            resolvedAt: now,
          },
        });
        await transaction.prediction.update({
          where: { id: prediction.id },
          data: { status: voided ? "CANCELED" : "RESOLVED" },
        });
        if (outcome === "CORRECT") {
          await transaction.fanScoreEvent.create({
            data: {
              userId: prediction.userId,
              eventType: "CORRECT_PREDICTION",
              sourceType: "PREDICTION",
              sourceId: prediction.id,
              points: FAN_SCORE_POINTS.CORRECT_PREDICTION,
              reason: "Correctly predicted the game winner",
              idempotencyKey: `prediction-correct:${prediction.id}`,
            },
          });
          await transaction.profile.update({
            where: { userId: prediction.userId },
            data: {
              reputation: {
                increment: FAN_SCORE_POINTS.CORRECT_PREDICTION,
              },
              predictionCorrect: { increment: 1 },
              predictionTotal: { increment: 1 },
            },
          });
        } else if (outcome === "INCORRECT") {
          await transaction.profile.update({
            where: { userId: prediction.userId },
            data: { predictionTotal: { increment: 1 } },
          });
        }
        await transaction.notification.create({
          data: {
            recipientId: prediction.userId,
            type: "PREDICTION",
            entityType: "PREDICTION",
            entityId: prediction.id,
            href: `/games/${game.id}`,
            deduplicationKey: `prediction-result:${prediction.id}`,
            payload: { outcome, winningSelection },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    if (!voided && prediction.selection === winningSelection) {
      await awardBadge(db, {
        userId: prediction.userId,
        badgeKey: "perfect-read",
        reason: "Made a correct game prediction",
      });
    }
    resolved += 1;
  }
  return { resolved, skipped: game.predictions.length - resolved };
}
