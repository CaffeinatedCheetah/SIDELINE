import { db } from "@/lib/db/client";
import { withJobLease } from "@/lib/jobs/lease";

export async function finalizeAccountDeletions(now = new Date()) {
  return withJobLease("account-deletions", async () => {
    const users = await db.user.findMany({
      where: { status: "PENDING_DELETION", deletedAt: { lte: now } },
      select: { id: true },
      take: 100,
    });
    for (const user of users) {
      await db.$transaction(async (tx) => {
        const claimed = await tx.user.updateMany({
          where: {
            id: user.id,
            status: "PENDING_DELETION",
            deletedAt: { lte: now },
          },
          data: {
            status: "DELETED",
            name: null,
            email: null,
            emailVerified: null,
            image: null,
            displayName: "Deleted fan",
            handle: "deleted-" + user.id,
            normalizedHandle: "deleted-" + user.id,
            role: "USER",
            isOfficial: false,
          },
        });
        if (!claimed.count) return;
        await tx.account.deleteMany({ where: { userId: user.id } });
        await tx.session.deleteMany({ where: { userId: user.id } });
        await tx.profile.deleteMany({ where: { userId: user.id } });
        await tx.userPreference.deleteMany({ where: { userId: user.id } });
        await tx.teamFollow.deleteMany({ where: { userId: user.id } });
        await tx.gameFollow.deleteMany({ where: { userId: user.id } });
        await tx.follow.deleteMany({
          where: { OR: [{ followerId: user.id }, { followedId: user.id }] },
        });
        await tx.communityMember.deleteMany({ where: { userId: user.id } });
        await tx.savedItem.deleteMany({ where: { userId: user.id } });
        await tx.mute.deleteMany({ where: { userId: user.id } });
        await tx.notification.deleteMany({
          where: { OR: [{ recipientId: user.id }, { actorId: user.id }] },
        });
        await tx.take.updateMany({
          where: { authorId: user.id },
          data: { body: "", status: "AUTHOR_REMOVED", deletedAt: now },
        });
        await tx.comment.updateMany({
          where: { authorId: user.id },
          data: { body: "", status: "AUTHOR_REMOVED", deletedAt: now },
        });
        await tx.debate.updateMany({
          where: { creatorId: user.id },
          data: { title: "Removed discussion", prompt: "", status: "ARCHIVED" },
        });
      });
    }
    return { processed: users.length };
  });
}
