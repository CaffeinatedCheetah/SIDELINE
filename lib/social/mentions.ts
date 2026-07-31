import type { PrismaClient } from "@prisma/client";

import { createNotification } from "@/lib/notifications/service";

const MENTION_PATTERN = /(^|[^\w])@([a-z0-9-]{3,30})\b/gi;

export function extractMentionHandles(value: string) {
  const handles = new Set<string>();
  for (const match of value.matchAll(MENTION_PATTERN)) {
    handles.add(match[2]!.toLowerCase());
  }
  return [...handles];
}

export async function notifyMentions(
  db: PrismaClient,
  input: {
    actorId: string;
    body: string;
    entityType: "TAKE" | "DEBATE";
    entityId: string;
    href: string;
  },
) {
  const handles = extractMentionHandles(input.body);
  if (!handles.length) return [];

  const recipients = await db.user.findMany({
    where: {
      normalizedHandle: { in: handles },
      status: "ACTIVE",
      deletedAt: null,
      id: { not: input.actorId },
      blocksMade: { none: { blockedId: input.actorId } },
    },
    select: { id: true },
  });

  return Promise.allSettled(
    recipients.map(({ id: recipientId }) =>
      createNotification(db, {
        recipientId,
        actorId: input.actorId,
        type: "MENTION",
        entityType: input.entityType,
        entityId: input.entityId,
        href: input.href,
        deduplicationKey: `mention:${input.entityType}:${input.entityId}:${recipientId}`,
      }),
    ),
  );
}
