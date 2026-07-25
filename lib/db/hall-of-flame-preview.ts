import { db } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";

export type HallOfFlamePreviewEntry = Prisma.HallOfFlameEntryGetPayload<{
  include: {
    take: {
      select: {
        authorId: true;
        author: {
          select: {
            handle: true;
            displayName: true;
            image: true;
            profile: { select: { reputation: true } };
            badges: {
              select: { badge: { select: { name: true; icon: true } } };
            };
          };
        };
      };
    };
  };
}>;

export async function getHallOfFlamePreview(
  viewerId: string | undefined,
  take = 5,
): Promise<{ entries: HallOfFlamePreviewEntry[]; failed: boolean }> {
  try {
    let excludedAuthorIds: string[] = [];
    if (viewerId) {
      const blocks = await db.block.findMany({
        where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] },
        select: { blockerId: true, blockedId: true },
      });
      excludedAuthorIds = blocks.map((b) =>
        b.blockerId === viewerId ? b.blockedId : b.blockerId,
      );
    }

    const entries = (await db.hallOfFlameEntry.findMany({
      take,
      orderBy: [{ periodStart: "desc" }, { rank: "asc" }],
      where: excludedAuthorIds.length
        ? { take: { authorId: { notIn: excludedAuthorIds } } }
        : undefined,
      include: {
        take: {
          select: {
            authorId: true,
            author: {
              select: {
                handle: true,
                displayName: true,
                image: true,
                profile: { select: { reputation: true } },
                badges: {
                  take: 1,
                  orderBy: { awardedAt: "desc" },
                  select: { badge: { select: { name: true, icon: true } } },
                },
              },
            },
          },
        },
      },
    })) as HallOfFlamePreviewEntry[];

    return { entries, failed: false };
  } catch (error) {
    console.error(
      "[getHallOfFlamePreview] query failed:",
      error instanceof Error ? `${error.name}: ${error.message}` : "unknown error",
    );
    return { entries: [], failed: true };
  }
}
