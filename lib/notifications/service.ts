import {
  type NotificationType,
  Prisma,
  type PrismaClient,
} from "@prisma/client";

const DEFAULT_NOTIFICATION_SETTINGS: Record<NotificationType, boolean> = {
  REPLY: true,
  REACTION: true,
  FOLLOW: true,
  DEBATE: true,
  COMMUNITY: true,
  GAME: true,
  PREDICTION: true,
  MODERATION: true,
  BADGE: true,
};

export async function createNotification(
  db: PrismaClient,
  input: {
    recipientId: string;
    actorId?: string;
    type: NotificationType;
    entityType: string;
    entityId: string;
    href: string;
    deduplicationKey: string;
    payload?: Prisma.InputJsonValue;
  },
) {
  if (input.actorId === input.recipientId) return null;
  const preferences = await db.userPreference.findUnique({
    where: { userId: input.recipientId },
    select: { notificationSettings: true },
  });
  const configured =
    preferences?.notificationSettings &&
    typeof preferences.notificationSettings === "object" &&
    !Array.isArray(preferences.notificationSettings)
      ? (preferences.notificationSettings as Record<string, unknown>)
      : {};
  if (
    configured[input.type] === false ||
    (!DEFAULT_NOTIFICATION_SETTINGS[input.type] &&
      configured[input.type] !== true)
  )
    return null;

  return db.notification.upsert({
    where: { deduplicationKey: input.deduplicationKey },
    update: {},
    create: {
      recipientId: input.recipientId,
      actorId: input.actorId,
      type: input.type,
      entityType: input.entityType,
      entityId: input.entityId,
      href: input.href,
      deduplicationKey: input.deduplicationKey,
      payload: input.payload,
    },
  });
}
