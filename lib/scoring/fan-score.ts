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
  return db.fanScoreEvent.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    update: {},
    create: {
      userId: input.userId,
      eventType: input.type,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      points: FAN_SCORE_POINTS[input.type],
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
    },
  });
}

export function totalFanScore(events: readonly { points: number }[]) {
  return events.reduce((sum, event) => sum + event.points, 0);
}
