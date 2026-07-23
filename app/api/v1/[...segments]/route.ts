import { ContentStatus, DebateStatus, VoteKind } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/auth";
import { apiError, apiSuccess, cursorPage, parseJson } from "@/lib/api/http";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { db } from "@/lib/db/client";
import { recordFanScoreEvent } from "@/lib/scoring/fan-score";
import { assertPredictionOpen } from "@/lib/services/predictions";

type Context = { params: Promise<{ segments: string[] }> };

async function identity() {
  const session = await auth();
  return session?.user?.id;
}

export async function GET(request: Request, context: Context) {
  const { segments } = await context.params;
  const resource = segments[0];
  const url = new URL(request.url);
  const { limit, cursor } = cursorPage(url.searchParams);
  const page = {
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  };

  if (resource === "games")
    return apiSuccess(
      await db.game.findMany({
        ...page,
        orderBy: { scheduledAt: "asc" },
        include: { homeTeam: true, awayTeam: true, league: true },
      }),
    );
  if (resource === "communities")
    return apiSuccess(
      await db.community.findMany({
        ...page,
        where: { status: ContentStatus.ACTIVE },
        orderBy: { name: "asc" },
        include: { _count: { select: { members: true } } },
      }),
    );
  if (resource === "debates")
    return apiSuccess(
      await db.debate.findMany({
        ...page,
        where: { status: DebateStatus.OPEN },
        orderBy: { createdAt: "desc" },
        include: {
          options: {
            orderBy: { displayOrder: "asc" },
            include: { _count: { select: { votes: true } } },
          },
        },
      }),
    );
  if (resource === "takes")
    return apiSuccess(
      await db.take.findMany({
        ...page,
        where: { status: ContentStatus.ACTIVE },
        orderBy: { createdAt: "desc" },
        include: {
          author: { select: { handle: true, displayName: true, image: true } },
          _count: { select: { reactions: true, replies: true } },
        },
      }),
    );
  if (resource === "users" && segments[1])
    return apiSuccess(
      await db.user.findUnique({
        where: { normalizedHandle: segments[1].toLowerCase() },
        select: {
          id: true,
          handle: true,
          displayName: true,
          image: true,
          profile: true,
          _count: { select: { followers: true, following: true, takes: true } },
        },
      }),
    );
  if (resource === "notifications") {
    const userId = await identity();
    if (!userId)
      return apiError("AUTH_REQUIRED", "Sign in to view notifications.", 401);
    return apiSuccess(
      await db.notification.findMany({
        ...page,
        where: { recipientId: userId },
        orderBy: { createdAt: "desc" },
      }),
    );
  }
  if (resource === "fan-score") {
    const userId = await identity();
    if (!userId)
      return apiError("AUTH_REQUIRED", "Sign in to view Fan Score.", 401);
    const aggregate = await db.fanScoreEvent.aggregate({
      where: { userId },
      _sum: { points: true },
    });
    return apiSuccess({
      score: aggregate._sum.points ?? 0,
      events: await db.fanScoreEvent.findMany({
        where: { userId },
        orderBy: { occurredAt: "desc" },
        take: limit,
      }),
    });
  }
  if (resource === "hall-of-flame")
    return apiSuccess(
      await db.hallOfFlameEntry.findMany({
        ...page,
        orderBy: [{ periodStart: "desc" }, { rank: "asc" }],
        include: {
          take: {
            include: {
              author: { select: { handle: true, displayName: true } },
            },
          },
        },
      }),
    );
  if (resource === "search") {
    const query = url.searchParams.get("q")?.trim();
    if (!query || query.length < 2)
      return apiSuccess({
        users: [],
        teams: [],
        games: [],
        communities: [],
        debates: [],
        takes: [],
      });
    const contains = { contains: query, mode: "insensitive" as const };
    const [users, teams, communities, debates, takes] = await Promise.all([
      db.user.findMany({
        where: { OR: [{ displayName: contains }, { handle: contains }] },
        select: { handle: true, displayName: true, image: true },
        take: 5,
      }),
      db.team.findMany({
        where: { OR: [{ name: contains }, { abbreviation: contains }] },
        take: 5,
      }),
      db.community.findMany({
        where: { name: contains, status: ContentStatus.ACTIVE },
        take: 5,
      }),
      db.debate.findMany({
        where: { title: contains, status: DebateStatus.OPEN },
        take: 5,
      }),
      db.take.findMany({
        where: { body: contains, status: ContentStatus.ACTIVE },
        take: 5,
      }),
    ]);
    return apiSuccess({ users, teams, communities, debates, takes });
  }
  return apiError("NOT_FOUND", "API resource not found.", 404);
}

export async function POST(request: Request, context: Context) {
  const { segments } = await context.params;
  const resource = segments[0];
  const userId = await identity();
  if (!userId) return apiError("AUTH_REQUIRED", "Sign in to continue.", 401);
  if (!checkRateLimit(`${userId}:${resource}`).allowed)
    return apiError("RATE_LIMITED", "Please wait before trying again.", 429);

  if (resource === "profile" && segments[1] === "complete") {
    const parsed = await parseJson(
      request,
      z.object({
        displayName: z.string().trim().min(2).max(50),
        handle: z
          .string()
          .trim()
          .regex(/^[a-z0-9-]{3,30}$/),
        favoriteSports: z.array(z.string().uuid()).max(10),
        favoriteTeams: z.array(z.string().uuid()).max(20),
        avatarUrl: z.string().url().optional(),
      }),
    );
    if (!parsed.success)
      return apiError(
        "INVALID_REQUEST",
        "Check your onboarding details.",
        400,
        parsed.error.flatten(),
      );
    const result = await db.user.update({
      where: { id: userId },
      data: {
        displayName: parsed.data.displayName,
        handle: parsed.data.handle,
        normalizedHandle: parsed.data.handle.toLowerCase(),
        image: parsed.data.avatarUrl,
        onboardedAt: new Date(),
        profile: {
          upsert: {
            create: {
              favoriteSports: parsed.data.favoriteSports,
              favoriteTeams: parsed.data.favoriteTeams,
              avatarUrl: parsed.data.avatarUrl,
            },
            update: {
              favoriteSports: parsed.data.favoriteSports,
              favoriteTeams: parsed.data.favoriteTeams,
              avatarUrl: parsed.data.avatarUrl,
            },
          },
        },
      },
    });
    return apiSuccess({ id: result.id, handle: result.handle }, 201);
  }
  if (resource === "community-membership") {
    const parsed = await parseJson(
      request,
      z.object({
        communityId: z.string().uuid(),
        join: z.boolean(),
        notifications: z.boolean().default(true),
      }),
    );
    if (!parsed.success)
      return apiError(
        "INVALID_REQUEST",
        "Invalid community membership request.",
        400,
        parsed.error.flatten(),
      );
    if (!parsed.data.join) {
      await db.communityMember.deleteMany({
        where: { userId, communityId: parsed.data.communityId },
      });
      return apiSuccess({ joined: false });
    }
    await db.communityMember.upsert({
      where: {
        communityId_userId: { userId, communityId: parsed.data.communityId },
      },
      update: { status: "ACTIVE", notifications: parsed.data.notifications },
      create: {
        userId,
        communityId: parsed.data.communityId,
        notifications: parsed.data.notifications,
        rulesAcceptedAt: new Date(),
      },
    });
    return apiSuccess({ joined: true }, 201);
  }
  if (resource === "takes") {
    const parsed = await parseJson(
      request,
      z.object({
        body: z.string().trim().min(1).max(1000),
        gameId: z.string().uuid().optional(),
        debateId: z.string().uuid().optional(),
        communityId: z.string().uuid().optional(),
        parentId: z.string().uuid().optional(),
      }),
    );
    if (!parsed.success)
      return apiError(
        "INVALID_REQUEST",
        "Invalid take.",
        400,
        parsed.error.flatten(),
      );
    const take = await db.take.create({
      data: { ...parsed.data, authorId: userId },
    });
    await recordFanScoreEvent(db, {
      userId,
      type: parsed.data.parentId ? "CONSTRUCTIVE_REPLY" : "QUALITY_TAKE",
      sourceType: "TAKE",
      sourceId: take.id,
      idempotencyKey: `take:${take.id}`,
      reason: parsed.data.parentId
        ? "Posted a constructive reply"
        : "Posted a substantive take",
    });
    return apiSuccess(take, 201);
  }
  if (resource === "debates") {
    const parsed = await parseJson(
      request,
      z.object({
        title: z.string().trim().min(10).max(140),
        prompt: z.string().trim().min(20).max(2000),
        slug: z.string().regex(/^[a-z0-9-]+$/),
        options: z.array(z.string().trim().min(1).max(80)).min(2).max(6),
        gameId: z.string().uuid().optional(),
        communityId: z.string().uuid().optional(),
      }),
    );
    if (!parsed.success)
      return apiError(
        "INVALID_REQUEST",
        "Invalid debate.",
        400,
        parsed.error.flatten(),
      );
    const debate = await db.debate.create({
      data: {
        creatorId: userId,
        title: parsed.data.title,
        prompt: parsed.data.prompt,
        slug: parsed.data.slug,
        gameId: parsed.data.gameId,
        communityId: parsed.data.communityId,
        status: DebateStatus.OPEN,
        opensAt: new Date(),
        options: {
          create: parsed.data.options.map((label, index) => ({
            key: `option-${index + 1}`,
            label,
            displayOrder: index + 1,
          })),
        },
      },
      include: { options: true },
    });
    return apiSuccess(debate, 201);
  }
  if (resource === "votes") {
    const parsed = await parseJson(
      request,
      z.object({ debateId: z.string().uuid(), optionId: z.string().uuid() }),
    );
    if (!parsed.success)
      return apiError(
        "INVALID_REQUEST",
        "Invalid vote.",
        400,
        parsed.error.flatten(),
      );
    const option = await db.debateOption.findFirst({
      where: {
        id: parsed.data.optionId,
        debateId: parsed.data.debateId,
        debate: { status: DebateStatus.OPEN },
      },
    });
    if (!option)
      return apiError("INVALID_OPTION", "That option is not available.", 409);
    try {
      return apiSuccess(
        await db.vote.create({
          data: {
            userId,
            debateId: parsed.data.debateId,
            debateOptionId: option.id,
            kind: VoteKind.DEBATE_OPTION,
          },
        }),
        201,
      );
    } catch {
      return apiError(
        "DUPLICATE_VOTE",
        "You already voted in this debate.",
        409,
      );
    }
  }
  if (resource === "predictions") {
    const parsed = await parseJson(
      request,
      z.object({
        gameId: z.string().uuid(),
        selection: z.string().min(1).max(100),
        idempotencyKey: z.string().min(8).max(100),
      }),
    );
    if (!parsed.success)
      return apiError(
        "INVALID_REQUEST",
        "Invalid prediction.",
        400,
        parsed.error.flatten(),
      );
    const game = await db.game.findUnique({
      where: { id: parsed.data.gameId },
    });
    if (!game) return apiError("NOT_FOUND", "Game not found.", 404);
    try {
      assertPredictionOpen({
        locksAt: game.scheduledAt,
        gameStatus: game.status,
      });
    } catch {
      return apiError(
        "PREDICTION_LOCKED",
        "Predictions are locked for this game.",
        409,
      );
    }
    return apiSuccess(
      await db.prediction.upsert({
        where: { gameId_userId: { gameId: game.id, userId } },
        update: { selection: parsed.data.selection },
        create: {
          gameId: game.id,
          userId,
          selection: parsed.data.selection,
          locksAt: game.scheduledAt,
          idempotencyKey: parsed.data.idempotencyKey,
        },
      }),
      201,
    );
  }
  if (resource === "notifications" && segments[1] === "read-all") {
    await db.notification.updateMany({
      where: { recipientId: userId, readAt: null },
      data: { readAt: new Date() },
    });
    return apiSuccess({ read: true });
  }
  if (resource === "reports") {
    const parsed = await parseJson(
      request,
      z.object({
        targetType: z.string().min(1).max(30),
        targetId: z.string().min(1).max(100),
        reason: z.string().min(1).max(50),
        detail: z.string().max(1000).optional(),
      }),
    );
    if (!parsed.success)
      return apiError(
        "INVALID_REQUEST",
        "Invalid report.",
        400,
        parsed.error.flatten(),
      );
    return apiSuccess(
      await db.report.create({ data: { reporterId: userId, ...parsed.data } }),
      201,
    );
  }
  return apiError("NOT_FOUND", "API operation not found.", 404);
}
