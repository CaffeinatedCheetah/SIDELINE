import type { PrismaClient } from "@prisma/client";

export const FAN_SCORE_POINTS = {
  QUALITY_TAKE: 10,
  CONSTRUCTIVE_REPLY: 4,
  CORRECT_PREDICTION: 15,
  RECEIVED_INSIGHTFUL: 2,
  MODERATION_PENALTY: -25,
} as const;

export type FanScoreEventType = keyof typeof FAN_SCORE_POINTS;

export async function recordFanScoreEvent(
  db: PrismaClient,
  input: {
    userId: string;
    type: FanScoreEventType;
    sourceType: string;
    sourceId: string;
    idempotencyKey: string;
    reason: string;
  },
) {
  return db.$transaction(async (transaction) => {
    const existing = await transaction.fanScoreEvent.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) return existing;
    const event = await transaction.fanScoreEvent.create({
      data: {
        userId: input.userId,
        eventType: input.type,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        points: FAN_SCORE_POINTS[input.type],
        reason: input.reason,
        idempotencyKey: input.idempotencyKey,
      },
    });
    await transaction.profile.upsert({
      where: { userId: input.userId },
      create: {
        userId: input.userId,
        favoriteSports: [],
        favoriteTeams: [],
        reputation: event.points,
      },
      update: { reputation: { increment: event.points } },
    });
    return event;
  });
}

export async function reverseFanScoreEvent(
  db: PrismaClient,
  input: { eventId: string; reason: string },
) {
  const original = await db.fanScoreEvent.findUnique({
    where: { id: input.eventId },
  });
  if (!original) return null;
  return db.$transaction(async (transaction) => {
    const existing = await transaction.fanScoreEvent.findUnique({
      where: { reversalOfEventId: original.id },
    });
    if (existing) return existing;
    const reversal = await transaction.fanScoreEvent.create({
      data: {
        userId: original.userId,
        eventType: `${original.eventType}_REVERSAL`,
        sourceType: original.sourceType,
        sourceId: original.sourceId,
        points: -original.points,
        reason: input.reason,
        idempotencyKey: `reversal:${original.id}`,
        reversalOfEventId: original.id,
      },
    });
    await transaction.profile.update({
      where: { userId: original.userId },
      data: { reputation: { increment: reversal.points } },
    });
    return reversal;
  });
}

export function totalFanScore(events: readonly { points: number }[]) {
  return events.reduce((sum, event) => sum + event.points, 0);
}
