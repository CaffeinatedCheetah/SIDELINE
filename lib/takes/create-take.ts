import { canInteract } from "@/lib/permissions/visibility";
import { db } from "@/lib/db/client";
import { awardBadge } from "@/lib/badges/service";
import { recordFanScoreEvent } from "@/lib/scoring/fan-score";

export class TakeCreationError extends Error {
  constructor(
    readonly code: "FORBIDDEN" | "NOT_FOUND" | "CONTEXT_MISMATCH",
    message: string,
  ) {
    super(message);
  }
}

export async function createTake({
  authorId,
  body,
  gameId,
  debateId,
  communityId,
  parentId,
  flashThreadId,
}: {
  authorId: string;
  body: string;
  gameId?: string;
  debateId?: string;
  communityId?: string;
  parentId?: string;
  flashThreadId?: string;
}) {
  return db.$transaction(async (db) => {
    if (communityId) {
      const membership = await db.communityMember.findFirst({
        where: {
          communityId,
          userId: authorId,
          status: "ACTIVE",
          community: { status: "ACTIVE" },
        },
        select: { id: true },
      });
      if (!membership)
        throw new TakeCreationError(
          "FORBIDDEN",
          "Join this community before posting.",
        );
    }

    const parent = parentId
      ? await db.take.findUnique({
          where: { id: parentId },
          select: {
            authorId: true,
            status: true,
            communityId: true,
            debateId: true,
            gameId: true,
            flashThreadId: true,
            gamePeriod: true,
            gameClock: true,
            homeScoreContext: true,
            awayScoreContext: true,
          },
        })
      : null;
    if (parentId && !parent)
      throw new TakeCreationError("NOT_FOUND", "Parent Take not found.");
    if (
      parent &&
      (!(await canInteract(authorId, parent)) ||
        parent.communityId !== (communityId ?? null) ||
        parent.debateId !== (debateId ?? null))
    )
      throw new TakeCreationError(
        "FORBIDDEN",
        "Reply target is unavailable in this conversation.",
      );
    const resolvedFlashThreadId =
      flashThreadId ?? parent?.flashThreadId ?? undefined;
    const thread = resolvedFlashThreadId
      ? await db.flashThread.findUnique({
          where: { id: resolvedFlashThreadId },
          select: {
            id: true,
            gameId: true,
            status: true,
            moment: {
              select: {
                period: true,
                clock: true,
                homeScore: true,
                awayScore: true,
              },
            },
          },
        })
      : null;
    if (resolvedFlashThreadId && !thread)
      throw new TakeCreationError("NOT_FOUND", "Flash Thread not found.");
    if (thread?.status === "ARCHIVED")
      throw new TakeCreationError(
        "FORBIDDEN",
        "This Flash Thread is archived and is now read-only.",
      );
    const resolvedGameId =
      thread?.gameId ?? gameId ?? parent?.gameId ?? undefined;
    if (thread && gameId && thread.gameId !== gameId)
      throw new TakeCreationError(
        "CONTEXT_MISMATCH",
        "Flash Thread does not belong to this game.",
      );

    const take = await db.take.create({
      data: {
        authorId,
        body,
        gameId: resolvedGameId,
        debateId,
        communityId,
        parentId,
        flashThreadId: resolvedFlashThreadId,
        gamePeriod: thread?.moment.period ?? parent?.gamePeriod,
        gameClock: thread?.moment.clock ?? parent?.gameClock,
        homeScoreContext: thread?.moment.homeScore ?? parent?.homeScoreContext,
        awayScoreContext: thread?.moment.awayScore ?? parent?.awayScoreContext,
      },
    });
    if (
      body.trim().length >= 20 &&
      !(await db.take.findFirst({
        where: {
          authorId,
          body,
          id: { not: take.id },
          createdAt: { gte: new Date(Date.now() - 86_400_000) },
        },
      }))
    )
      await recordFanScoreEvent(db, {
        userId: authorId,
        type: parentId ? "CONSTRUCTIVE_REPLY" : "QUALITY_TAKE",
        sourceType: "TAKE",
        sourceId: take.id,
        idempotencyKey: `take:${take.id}`,
        reason: parentId
          ? "Participation reward for an eligible reply"
          : "Participation reward for an eligible take",
      });
    if (!parentId)
      await awardBadge(db, {
        userId: authorId,
        badgeKey: "first-take",
        reason: "Posted their first take",
      });
    return take;
  });
}
