import type { Prisma, PrismaClient } from "@prisma/client";

export const FAN_SCORE_POINTS = {
  QUALITY_TAKE: 10,
  CONSTRUCTIVE_REPLY: 4,
  CORRECT_PREDICTION: 15,
  RECEIVED_INSIGHTFUL: 2,
  MODERATION_PENALTY: -25,
} as const;

export type FanScoreEventType = keyof typeof FAN_SCORE_POINTS;

export async function recordFanScoreEvent(
  db: PrismaClient | Prisma.TransactionClient,
  input: {
    userId: string;
    type: FanScoreEventType;
    sourceType: string;
    sourceId: string;
    idempotencyKey: string;
    reason: string;
  },
) {
  return transact(db, async (transaction) => {
    await transaction.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${input.userId}))`;
    const existing = await transaction.fanScoreEvent.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) return existing;
    const postingReward =
      input.type === "QUALITY_TAKE" || input.type === "CONSTRUCTIVE_REPLY";
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const awards = postingReward
      ? await transaction.fanScoreEvent.count({
          where: {
            userId: input.userId,
            eventType: { in: ["QUALITY_TAKE", "CONSTRUCTIVE_REPLY"] },
            occurredAt: { gte: today },
            points: { gt: 0 },
          },
        })
      : 0;
    const event = await transaction.fanScoreEvent.create({
      data: {
        userId: input.userId,
        eventType: input.type,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        points:
          postingReward && awards >= 10 ? 0 : FAN_SCORE_POINTS[input.type],
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
  db: PrismaClient | Prisma.TransactionClient,
  input: { eventId: string; reason: string },
) {
  const original = await db.fanScoreEvent.findUnique({
    where: { id: input.eventId },
  });
  if (!original) return null;
  return transact(db, async (transaction) => {
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

function transact<T>(
  client: PrismaClient | Prisma.TransactionClient,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return "$transaction" in client ? client.$transaction(work) : work(client);
}
