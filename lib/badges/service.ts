import type { PrismaClient } from "@prisma/client";

import { createNotification } from "@/lib/notifications/service";

export async function awardBadge(
  db: PrismaClient,
  input: {
    userId: string;
    badgeKey: "first-take" | "perfect-read" | "community-builder";
    reason: string;
  },
) {
  const badge = await db.badge.findUnique({ where: { key: input.badgeKey } });
  if (!badge) return null;
  const user = await db.user.findUnique({
    where: { id: input.userId },
    select: { handle: true },
  });
  if (!user) return null;
  const award = await db.userBadge.upsert({
    where: { userId_badgeId: { userId: input.userId, badgeId: badge.id } },
    update: {},
    create: {
      userId: input.userId,
      badgeId: badge.id,
      reason: input.reason,
    },
  });
  await createNotification(db, {
    recipientId: input.userId,
    type: "BADGE",
    entityType: "BADGE",
    entityId: badge.id,
    href: `/u/${user.handle}#badges`,
    deduplicationKey: `badge:${input.userId}:${badge.id}`,
    payload: { badgeKey: badge.key, name: badge.name },
  });
  return award;
}
