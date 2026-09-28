import { Prisma, type PrismaClient } from "@prisma/client";
import { db } from "@/lib/db/client";

export function visibleUserWhere(viewerId?: string): Prisma.UserWhereInput {
  return {
    status: "ACTIVE",
    bannedAt: null,
    deletedAt: null,
    ...(viewerId
      ? {
          blocksMade: { none: { blockedId: viewerId } },
          blocksReceived: { none: { blockerId: viewerId } },
        }
      : {}),
  };
}

export function discoverableUserWhere(
  viewerId?: string,
): Prisma.UserWhereInput {
  return {
    ...visibleUserWhere(viewerId),
    OR: [
      { preferences: { is: null } },
      {
        preferences: {
          is: {
            privacySettings: {
              path: ["profileDiscoverable"],
              equals: Prisma.AnyNull,
            },
          },
        },
      },
      {
        preferences: {
          is: {
            NOT: {
              privacySettings: { path: ["profileDiscoverable"], equals: false },
            },
          },
        },
      },
    ],
  };
}

export async function canInteract(
  actorId: string,
  target: { authorId: string; status: string },
  client: PrismaClient | Prisma.TransactionClient = db,
) {
  if (target.status !== "ACTIVE") return false;
  return Boolean(
    await client.user.findFirst({
      where: { id: target.authorId, ...visibleUserWhere(actorId) },
      select: { id: true },
    }),
  );
}

export async function visibleTakesWhere(
  viewerId?: string,
): Promise<Prisma.TakeWhereInput> {
  const muted = viewerId
    ? await db.mute.findMany({
        where: { userId: viewerId, targetType: "USER" },
        select: { targetId: true },
      })
    : [];
  return {
    status: "ACTIVE",
    deletedAt: null,
    author: {
      ...visibleUserWhere(viewerId),
      id: { notIn: muted.map((row) => row.targetId) },
    },
  };
}
