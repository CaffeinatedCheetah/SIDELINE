import { ContentStatus, DebateStatus, Prisma, VoteKind } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/auth";
import { apiError, apiSuccess, cursorPage, parseJson } from "@/lib/api/http";
import {
  checkRateLimit,
  rateLimitKey,
  rateLimitPolicy,
} from "@/lib/api/rate-limit";
import { db } from "@/lib/db/client";
import { createNotification } from "@/lib/notifications/service";
import {
  recordFanScoreEvent,
  reverseFanScoreEvent,
} from "@/lib/scoring/fan-score";
import { assertPredictionOpen } from "@/lib/services/predictions";
import { runHallOfFlameJob } from "@/lib/services/hall-of-flame-job";
import { getCanonicalGame } from "@/lib/sports/game-domain";
import { materializeContests } from "@/lib/sports/materializer";
import { getSportsSchedule } from "@/lib/sports/service";
import { createTake, TakeCreationError } from "@/lib/takes/create-take";

type Context = { params: Promise<{ segments: string[] }> };

async function identity() {
  const session = await auth();
  if (!session?.user?.id) return undefined;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { status: true, bannedAt: true },
  });
  if (!user || user.status !== "ACTIVE" || user.bannedAt) return undefined;
  return session.user.id;
}

async function mutationIdentity() {
  const session = await auth();
  if (!session?.user?.id)
    return {
      response: apiError("AUTH_REQUIRED", "Sign in to continue.", 401),
    };
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { status: true, bannedAt: true, mutedUntil: true },
  });
  if (!user || user.status !== "ACTIVE" || user.bannedAt)
    return {
      response: apiError(
        "ACCOUNT_RESTRICTED",
        "This account cannot perform that action.",
        403,
      ),
    };
  if (user.mutedUntil && user.mutedUntil.getTime() > Date.now())
    return {
      response: apiError(
        "ACCOUNT_MUTED",
        "Posting is temporarily unavailable for this account.",
        403,
      ),
    };
  return { userId: session.user.id };
}

async function resolveModerationTarget(
  targetType: "TAKE" | "COMMENT" | "USER",
  targetId: string,
) {
  if (targetType === "USER") {
    const user = await db.user.findUnique({
      where: { id: targetId },
      select: { id: true },
    });
    return user ? { userId: user.id } : undefined;
  }
  if (targetType === "TAKE") {
    const take = await db.take.findUnique({
      where: { id: targetId },
      select: { authorId: true },
    });
    return take ? { userId: take.authorId } : undefined;
  }
  const comment = await db.comment.findUnique({
    where: { id: targetId },
    select: { authorId: true },
  });
  return comment ? { userId: comment.authorId } : undefined;
}

async function handleGet(request: Request, context: Context) {
  const { segments } = await context.params;
  const resource = segments[0];
  const url = new URL(request.url);
  const { limit, cursor } = cursorPage(url.searchParams);
  const page = {
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  };

  if (resource === "games" && segments[1]) {
    const current = await db.game.findUnique({
      where: { id: segments[1] },
      select: {
        providerRef: true,
        status: true,
        league: { select: { key: true } },
      },
    });
    if (current?.providerRef && current.status !== "FINAL") {
      try {
        const schedule = await getSportsSchedule({
          leagueKeys: [current.league.key],
        });
        const contest = schedule.contests.find(
          (candidate) => candidate.id === current.providerRef,
        );
        if (contest) await materializeContests([contest]);
      } catch {
        // The persisted Game Room remains available during provider failures.
      }
    }
    const game = await getCanonicalGame(segments[1]);
    const userId = game ? await identity() : undefined;
    const following =
      game && userId
        ? Boolean(
            await db.gameFollow.findUnique({
              where: { userId_gameId: { userId, gameId: game.id } },
              select: { userId: true },
            }),
          )
        : false;
    return game
      ? apiSuccess({ ...game, following })
      : apiError("NOT_FOUND", "Game not found.", 404);
  }

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
    // Doc-specified bounds (docs/pages/SEARCH.md: "Query 2-100 chars").
    const query = url.searchParams.get("q")?.trim().slice(0, 100);
    const type = url.searchParams.get("type") ?? "all";
    if (!query || query.length < 2)
      return apiSuccess({
        users: [],
        games: [],
        communities: [],
        debates: [],
      });
    const contains = { contains: query, mode: "insensitive" as const };
    const [users, games, communities, debates] = await Promise.all([
      type === "all" || type === "people"
        ? db.user.findMany({
            where: { OR: [{ displayName: contains }, { handle: contains }] },
            select: { handle: true, displayName: true, image: true },
            take: 5,
          })
        : [],
      type === "all" || type === "games"
        ? db.game.findMany({
            where: {
              OR: [
                {
                  homeTeam: {
                    OR: [{ name: contains }, { abbreviation: contains }],
                  },
                },
                {
                  awayTeam: {
                    OR: [{ name: contains }, { abbreviation: contains }],
                  },
                },
              ],
            },
            include: { homeTeam: true, awayTeam: true, league: true },
            take: 5,
          })
        : [],
      type === "all" || type === "communities"
        ? db.community.findMany({
            where: { name: contains, status: ContentStatus.ACTIVE },
            take: 5,
          })
        : [],
      type === "all" || type === "debates"
        ? db.debate.findMany({
            where: { title: contains, status: DebateStatus.OPEN },
            take: 5,
          })
        : [],
    ]);
    return apiSuccess({ users, games, communities, debates });
  }
  return apiError("NOT_FOUND", "API resource not found.", 404);
}

async function handlePost(request: Request, context: Context) {
  const { segments } = await context.params;
  const resource = segments[0];
  const actor = await mutationIdentity();
  if (actor.response) return actor.response;
  const userId = actor.userId;
  const rateLimit = await checkRateLimit(
    rateLimitKey(request, resource, userId),
    rateLimitPolicy(resource),
  );
  if (!rateLimit.allowed)
    return apiError(
      "RATE_LIMITED",
      "Please wait before trying again.",
      429,
      undefined,
      { "Retry-After": String(rateLimit.retryAfterSeconds) },
    );

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
    let result;
    try {
      result = await db.user.update({
        where: { id: userId },
        data: {
          displayName: parsed.data.displayName,
          handle: parsed.data.handle.toLowerCase(),
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
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        return apiError(
          "HANDLE_TAKEN",
          "That fan handle is already taken.",
          409,
        );
      throw error;
    }
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
    const community = await db.community.findFirst({
      where: { id: parsed.data.communityId, status: ContentStatus.ACTIVE },
      select: { id: true, ownerId: true, slug: true },
    });
    if (!community) return apiError("NOT_FOUND", "Community not found.", 404);
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
    await createNotification(db, {
      recipientId: community.ownerId,
      actorId: userId,
      type: "COMMUNITY",
      entityType: "COMMUNITY",
      entityId: community.id,
      href: `/communities/${community.slug}`,
      deduplicationKey: `community-join:${community.id}:${userId}`,
      payload: { action: "joined" },
    });
    return apiSuccess({ joined: true }, 201);
  }
  if (resource === "game-follows") {
    const parsed = await parseJson(
      request,
      z.object({
        gameId: z.string().uuid(),
        follow: z.boolean(),
        notifications: z.boolean().default(true),
      }),
    );
    if (!parsed.success)
      return apiError("INVALID_REQUEST", "Invalid game follow request.", 400);
    const game = await db.game.findUnique({
      where: { id: parsed.data.gameId },
      select: { id: true },
    });
    if (!game) return apiError("NOT_FOUND", "Game not found.", 404);
    if (!parsed.data.follow) {
      await db.gameFollow.deleteMany({
        where: { userId, gameId: parsed.data.gameId },
      });
      return apiSuccess({ following: false });
    }
    await db.gameFollow.upsert({
      where: {
        userId_gameId: { userId, gameId: parsed.data.gameId },
      },
      update: { notifications: parsed.data.notifications },
      create: {
        userId,
        gameId: parsed.data.gameId,
        notifications: parsed.data.notifications,
      },
    });
    return apiSuccess({ following: true }, 201);
  }
  if (resource === "team-follows") {
    const parsed = await parseJson(
      request,
      z.object({
        teamId: z.string().uuid(),
        follow: z.boolean(),
      }),
    );
    if (!parsed.success)
      return apiError(
        "INVALID_REQUEST",
        "Invalid team follow request.",
        400,
        parsed.error.flatten(),
      );
    const team = await db.team.findUnique({
      where: { id: parsed.data.teamId },
      select: { id: true },
    });
    if (!team) return apiError("NOT_FOUND", "Team not found.", 404);

    if (parsed.data.follow) {
      await db.teamFollow.upsert({
        where: {
          userId_teamId: { userId, teamId: parsed.data.teamId },
        },
        update: {},
        create: { userId, teamId: parsed.data.teamId },
      });
    } else {
      await db.teamFollow.deleteMany({
        where: { userId, teamId: parsed.data.teamId },
      });
    }

    const followerCount = await db.teamFollow.count({
      where: { teamId: parsed.data.teamId },
    });
    return apiSuccess(
      {
        teamId: parsed.data.teamId,
        following: parsed.data.follow,
        followerCount,
      },
      parsed.data.follow ? 201 : 200,
    );
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
        flashThreadId: z.string().uuid().optional(),
      }),
    );
    if (!parsed.success)
      return apiError(
        "INVALID_REQUEST",
        "Invalid take.",
        400,
        parsed.error.flatten(),
      );
    try {
      return apiSuccess(
        await createTake({ authorId: userId, ...parsed.data }),
        201,
      );
    } catch (error) {
      if (error instanceof TakeCreationError)
        return apiError(
          error.code,
          error.message,
          error.code === "FORBIDDEN"
            ? 403
            : error.code === "NOT_FOUND"
              ? 404
              : 409,
        );
      throw error;
    }
  }
  if (resource === "comments") {
    const parsed = await parseJson(
      request,
      z
        .object({
          body: z.string().trim().min(1).max(1000),
          takeId: z.string().uuid().optional(),
          debateId: z.string().uuid().optional(),
          parentId: z.string().uuid().optional(),
        })
        .refine(
          (value) => Boolean(value.takeId) !== Boolean(value.debateId),
          "Choose exactly one comment context.",
        ),
    );
    if (!parsed.success)
      return apiError(
        "INVALID_REQUEST",
        "Invalid comment.",
        400,
        parsed.error.flatten(),
      );
    const comment = await db.comment.create({
      data: { authorId: userId, ...parsed.data },
    });
    await recordFanScoreEvent(db, {
      userId,
      type: "CONSTRUCTIVE_REPLY",
      sourceType: "COMMENT",
      sourceId: comment.id,
      idempotencyKey: `comment:${comment.id}`,
      reason: "Posted a constructive comment",
    });
    const recipient = parsed.data.parentId
      ? await db.comment.findUnique({
          where: { id: parsed.data.parentId },
          select: {
            authorId: true,
            takeId: true,
            debateId: true,
            author: { select: { handle: true } },
          },
        })
      : parsed.data.takeId
        ? await db.take.findUnique({
            where: { id: parsed.data.takeId },
            select: {
              authorId: true,
              gameId: true,
              debateId: true,
              communityId: true,
              author: { select: { handle: true } },
            },
          })
        : await db.debate.findUnique({
            where: { id: parsed.data.debateId! },
            select: { creatorId: true },
          });
    const recipientId =
      recipient && "authorId" in recipient
        ? recipient.authorId
        : recipient && "creatorId" in recipient
          ? recipient.creatorId
          : undefined;
    if (recipientId) {
      const href =
        recipient && "gameId" in recipient && recipient.gameId
          ? `/games/${recipient.gameId}`
          : recipient && "communityId" in recipient && recipient.communityId
            ? `/communities/${(await db.community.findUnique({ where: { id: recipient.communityId }, select: { slug: true } }))?.slug ?? ""}`
            : (recipient && "debateId" in recipient && recipient.debateId) ||
                parsed.data.debateId
              ? `/debates/${
                  (recipient &&
                    "debateId" in recipient &&
                    recipient.debateId) ??
                  parsed.data.debateId
                }`
              : recipient && "author" in recipient
                ? `/users/${recipient.author.handle}`
                : "/notifications";
      await createNotification(db, {
        recipientId,
        actorId: userId,
        type: "REPLY",
        entityType: "COMMENT",
        entityId: comment.id,
        href,
        deduplicationKey: `reply:${comment.id}`,
      });
    }
    return apiSuccess(comment, 201);
  }
  if (resource === "reactions") {
    const parsed = await parseJson(
      request,
      z
        .object({
          takeId: z.string().uuid().optional(),
          commentId: z.string().uuid().optional(),
          kind: z.enum(["FIRE", "INSIGHTFUL", "FUNNY", "DISAGREE"]),
        })
        .refine(
          (value) => Boolean(value.takeId) !== Boolean(value.commentId),
          "Choose exactly one reaction target.",
        ),
    );
    if (!parsed.success)
      return apiError(
        "INVALID_REQUEST",
        "Invalid reaction.",
        400,
        parsed.error.flatten(),
      );
    const existing = await db.reaction.findFirst({
      where: {
        userId,
        takeId: parsed.data.takeId,
        commentId: parsed.data.commentId,
        kind: parsed.data.kind,
      },
    });
    if (existing) {
      await db.reaction.delete({ where: { id: existing.id } });
      if (existing.kind === "INSIGHTFUL") {
        const scoreEvent = await db.fanScoreEvent.findUnique({
          where: { idempotencyKey: `reaction-insightful:${existing.id}` },
        });
        if (scoreEvent)
          await reverseFanScoreEvent(db, {
            eventId: scoreEvent.id,
            reason: "Insightful reaction removed",
          });
      }
      return apiSuccess({ active: false });
    }
    const reaction = await db.reaction.create({
      data: { userId, ...parsed.data },
    });
    const target = parsed.data.takeId
      ? await db.take.findUnique({
          where: { id: parsed.data.takeId },
          select: {
            authorId: true,
            gameId: true,
            debateId: true,
            community: { select: { slug: true } },
            author: { select: { handle: true } },
          },
        })
      : await db.comment.findUnique({
          where: { id: parsed.data.commentId! },
          select: {
            authorId: true,
            takeId: true,
            debateId: true,
            author: { select: { handle: true } },
          },
        });
    if (target) {
      const href =
        "gameId" in target && target.gameId
          ? `/games/${target.gameId}`
          : "community" in target && target.community
            ? `/communities/${target.community.slug}`
            : target.debateId
              ? `/debates/${target.debateId}`
              : `/users/${target.author.handle}`;
      await createNotification(db, {
        recipientId: target.authorId,
        actorId: userId,
        type: "REACTION",
        entityType: parsed.data.takeId ? "TAKE" : "COMMENT",
        entityId: parsed.data.takeId ?? parsed.data.commentId!,
        href,
        deduplicationKey: `reaction:${reaction.id}`,
        payload: { kind: reaction.kind },
      });
      if (reaction.kind === "INSIGHTFUL" && target.authorId !== userId) {
        await recordFanScoreEvent(db, {
          userId: target.authorId,
          type: "RECEIVED_INSIGHTFUL",
          sourceType: "REACTION",
          sourceId: reaction.id,
          idempotencyKey: `reaction-insightful:${reaction.id}`,
          reason: "Received an insightful reaction",
        });
      }
    }
    return apiSuccess({ active: true }, 201);
  }
  if (resource === "debates") {
    const parsed = await parseJson(
      request,
      z.object({
        title: z.string().trim().min(10).max(140),
        prompt: z.string().trim().min(20).max(2000),
        slug: z.string().regex(/^[a-z0-9-]+$/),
        options: z
          .array(z.string().trim().min(1).max(80))
          .min(2)
          .max(4)
          .refine(
            (options) =>
              new Set(options.map((option) => option.toLowerCase())).size ===
              options.length,
            "Debate options must be distinct.",
          ),
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
    if (parsed.data.communityId) {
      const membership = await db.communityMember.findFirst({
        where: {
          communityId: parsed.data.communityId,
          userId,
          status: "ACTIVE",
        },
        select: { id: true },
      });
      if (!membership)
        return apiError(
          "FORBIDDEN",
          "Join this community before starting a debate.",
          403,
        );
    }
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
    if (debate.communityId) {
      const members = await db.communityMember.findMany({
        where: {
          communityId: debate.communityId,
          status: "ACTIVE",
          notifications: true,
        },
        select: { userId: true },
      });
      await Promise.allSettled(
        members.map(({ userId: recipientId }) =>
          createNotification(db, {
            recipientId,
            actorId: userId,
            type: "DEBATE",
            entityType: "DEBATE",
            entityId: debate.id,
            href: `/debates/${debate.slug}`,
            deduplicationKey: `debate-opened:${debate.id}:${recipientId}`,
            payload: { title: debate.title },
          }),
        ),
      );
    }
    return apiSuccess(debate, 201);
  }
  if (resource === "votes") {
    const parsed = await parseJson(
      request,
      z.union([
        z.object({
          debateId: z.string().uuid(),
          optionId: z.string().uuid(),
        }),
        z.object({
          takeId: z.string().uuid(),
          kind: z.enum(["AGREE", "DISAGREE"]),
        }),
      ]),
    );
    if (!parsed.success)
      return apiError(
        "INVALID_REQUEST",
        "Invalid vote.",
        400,
        parsed.error.flatten(),
      );
    if ("takeId" in parsed.data) {
      const take = await db.take.findFirst({
        where: { id: parsed.data.takeId, status: ContentStatus.ACTIVE },
        select: { id: true },
      });
      if (!take) return apiError("NOT_FOUND", "Take not found.", 404);
      const vote = await db.vote.upsert({
        where: {
          userId_takeId: { userId, takeId: take.id },
        },
        update: { kind: parsed.data.kind },
        create: {
          userId,
          takeId: take.id,
          kind: parsed.data.kind,
        },
      });
      const grouped = await db.vote.groupBy({
        by: ["kind"],
        where: { takeId: take.id },
        _count: { _all: true },
      });
      return apiSuccess({
        vote,
        totals: Object.fromEntries(
          grouped.map((entry) => [entry.kind, entry._count._all]),
        ),
      });
    }
    const option = await db.debateOption.findFirst({
      where: {
        id: parsed.data.optionId,
        debateId: parsed.data.debateId,
        debate: { status: DebateStatus.OPEN },
      },
    });
    if (!option)
      return apiError("INVALID_OPTION", "That option is not available.", 409);
    let vote;
    try {
      vote = await db.vote.create({
        data: {
          userId,
          debateId: parsed.data.debateId,
          debateOptionId: option.id,
          kind: VoteKind.DEBATE_OPTION,
        },
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002"
      )
        throw error;
      return apiError(
        "DUPLICATE_VOTE",
        "You already voted in this debate.",
        409,
      );
    }
    const options = await db.debateOption.findMany({
      where: { debateId: parsed.data.debateId },
      orderBy: { displayOrder: "asc" },
      select: {
        id: true,
        _count: { select: { votes: true } },
      },
    });
    const total = options.reduce(
      (sum, debateOption) => sum + debateOption._count.votes,
      0,
    );
    return apiSuccess(
      {
        vote,
        total,
        results: options.map((debateOption) => ({
          optionId: debateOption.id,
          votes: debateOption._count.votes,
          percentage: total
            ? Number(((debateOption._count.votes / total) * 100).toFixed(2))
            : 0,
        })),
      },
      201,
    );
  }
  if (resource === "polls") {
    const parsed = await parseJson(
      request,
      z.object({
        question: z.string().trim().min(5).max(280),
        options: z.array(z.string().trim().min(1).max(80)).min(2).max(8),
        gameId: z.string().uuid().optional(),
        communityId: z.string().uuid().optional(),
        closesAt: z.coerce.date().optional(),
      }),
    );
    if (!parsed.success)
      return apiError(
        "INVALID_REQUEST",
        "Invalid poll.",
        400,
        parsed.error.flatten(),
      );
    if (parsed.data.communityId) {
      const allowed = await db.communityMember.findFirst({
        where: {
          communityId: parsed.data.communityId,
          userId,
          status: "ACTIVE",
          role: { in: ["OWNER", "MODERATOR"] },
        },
      });
      if (!allowed)
        return apiError(
          "FORBIDDEN",
          "Community moderator permission is required.",
          403,
        );
    }
    return apiSuccess(
      await db.poll.create({
        data: {
          question: parsed.data.question,
          gameId: parsed.data.gameId,
          communityId: parsed.data.communityId,
          closesAt: parsed.data.closesAt,
          options: {
            create: parsed.data.options.map((label, displayOrder) => ({
              label,
              displayOrder,
            })),
          },
        },
        include: { options: true },
      }),
      201,
    );
  }
  if (resource === "poll-votes") {
    const parsed = await parseJson(
      request,
      z.object({ pollId: z.string().uuid(), optionId: z.string().uuid() }),
    );
    if (!parsed.success)
      return apiError(
        "INVALID_REQUEST",
        "Invalid poll vote.",
        400,
        parsed.error.flatten(),
      );
    const option = await db.pollOption.findFirst({
      where: {
        id: parsed.data.optionId,
        pollId: parsed.data.pollId,
        poll: { OR: [{ closesAt: null }, { closesAt: { gt: new Date() } }] },
      },
    });
    if (!option)
      return apiError(
        "INVALID_OPTION",
        "That poll option is unavailable.",
        409,
      );
    try {
      return apiSuccess(
        await db.pollVote.create({
          data: { pollId: parsed.data.pollId, pollOptionId: option.id, userId },
        }),
        201,
      );
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002"
      )
        throw error;
      return apiError("DUPLICATE_VOTE", "You already voted in this poll.", 409);
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
  if (resource === "notifications" && segments[1] === "read") {
    const parsed = await parseJson(
      request,
      z.object({ notificationId: z.string().uuid() }),
    );
    if (!parsed.success)
      return apiError(
        "INVALID_REQUEST",
        "Invalid notification request.",
        400,
        parsed.error.flatten(),
      );
    const result = await db.notification.updateMany({
      where: { id: parsed.data.notificationId, recipientId: userId },
      data: { readAt: new Date() },
    });
    if (!result.count)
      return apiError("NOT_FOUND", "Notification not found.", 404);
    return apiSuccess({ read: true });
  }
  if (resource === "follows") {
    const parsed = await parseJson(
      request,
      z.object({ userId: z.string().uuid(), follow: z.boolean() }),
    );
    if (!parsed.success || parsed.data.userId === userId)
      return apiError("INVALID_REQUEST", "Invalid follow request.", 400);
    const target = await db.user.findFirst({
      where: { id: parsed.data.userId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!target) return apiError("NOT_FOUND", "User not found.", 404);
    if (!parsed.data.follow) {
      await db.$transaction([
        db.follow.deleteMany({
          where: { followerId: userId, followedId: parsed.data.userId },
        }),
        db.notification.deleteMany({
          where: {
            deduplicationKey: `follow:${userId}:${parsed.data.userId}`,
            recipientId: parsed.data.userId,
            actorId: userId,
          },
        }),
      ]);
      return apiSuccess({ following: false });
    }
    const existing = await db.follow.findUnique({
      where: {
        followerId_followedId: {
          followerId: userId,
          followedId: parsed.data.userId,
        },
      },
    });
    if (!existing) {
      const actor = await db.user.findUniqueOrThrow({
        where: { id: userId },
        select: { handle: true },
      });
      // Block and mute relationships suppress ordinary notifications.
      const suppressed = await db.user.findFirst({
        where: {
          id: parsed.data.userId,
          OR: [
            { blocksMade: { some: { blockedId: userId } } },
            { mutes: { some: { targetType: "USER", targetId: userId } } },
          ],
        },
        select: { id: true },
      });
      try {
        await db.follow.create({
          data: { followerId: userId, followedId: parsed.data.userId },
        });
        if (!suppressed)
          await createNotification(db, {
            recipientId: parsed.data.userId,
            actorId: userId,
            type: "FOLLOW",
            entityType: "USER",
            entityId: userId,
            href: `/users/${actor.handle}`,
            deduplicationKey: `follow:${userId}:${parsed.data.userId}`,
          });
      } catch (error) {
        if (
          !(
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002"
          )
        )
          throw error;
      }
    }
    return apiSuccess({ following: true }, 201);
  }
  if (resource === "blocks") {
    const parsed = await parseJson(
      request,
      z.object({ userId: z.string().uuid(), block: z.boolean() }),
    );
    if (!parsed.success || parsed.data.userId === userId)
      return apiError("INVALID_REQUEST", "Invalid block request.", 400);
    if (!parsed.data.block) {
      await db.block.deleteMany({
        where: { blockerId: userId, blockedId: parsed.data.userId },
      });
      return apiSuccess({ blocked: false });
    }
    const target = await db.user.findFirst({
      where: { id: parsed.data.userId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!target) return apiError("NOT_FOUND", "User not found.", 404);
    await db.$transaction([
      db.block.upsert({
        where: {
          blockerId_blockedId: {
            blockerId: userId,
            blockedId: parsed.data.userId,
          },
        },
        update: {},
        create: { blockerId: userId, blockedId: parsed.data.userId },
      }),
      // A block immediately ends any mutual follow -- matches the doc's
      // "block confirms and immediately hides interaction."
      db.follow.deleteMany({
        where: {
          OR: [
            { followerId: userId, followedId: parsed.data.userId },
            { followerId: parsed.data.userId, followedId: userId },
          ],
        },
      }),
    ]);
    return apiSuccess({ blocked: true }, 201);
  }
  if (resource === "mutes") {
    const parsed = await parseJson(
      request,
      z.object({ userId: z.string().uuid(), mute: z.boolean() }),
    );
    if (!parsed.success || parsed.data.userId === userId)
      return apiError("INVALID_REQUEST", "Invalid mute request.", 400);
    if (!parsed.data.mute) {
      await db.mute.deleteMany({
        where: { userId, targetType: "USER", targetId: parsed.data.userId },
      });
      return apiSuccess({ muted: false });
    }
    const target = await db.user.findFirst({
      where: { id: parsed.data.userId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!target) return apiError("NOT_FOUND", "User not found.", 404);
    await db.mute.upsert({
      where: {
        userId_targetType_targetId: {
          userId,
          targetType: "USER",
          targetId: parsed.data.userId,
        },
      },
      update: {},
      create: { userId, targetType: "USER", targetId: parsed.data.userId },
    });
    return apiSuccess({ muted: true }, 201);
  }
  if (resource === "saved-items") {
    const parsed = await parseJson(
      request,
      z.object({
        kind: z.enum(["TAKE", "DEBATE", "GAME", "COMMUNITY"]),
        entityId: z.string().min(1).max(100),
        save: z.boolean(),
      }),
    );
    if (!parsed.success)
      return apiError(
        "INVALID_REQUEST",
        "Invalid save request.",
        400,
        parsed.error.flatten(),
      );
    if (!parsed.data.save) {
      await db.savedItem.deleteMany({
        where: {
          userId,
          kind: parsed.data.kind,
          entityId: parsed.data.entityId,
        },
      });
      return apiSuccess({ saved: false });
    }
    await db.savedItem.upsert({
      where: {
        userId_kind_entityId: {
          userId,
          kind: parsed.data.kind,
          entityId: parsed.data.entityId,
        },
      },
      update: {},
      create: {
        userId,
        kind: parsed.data.kind,
        entityId: parsed.data.entityId,
        ...(parsed.data.kind === "TAKE"
          ? { takeId: parsed.data.entityId }
          : {}),
        ...(parsed.data.kind === "DEBATE"
          ? { debateId: parsed.data.entityId }
          : {}),
      },
    });
    return apiSuccess({ saved: true }, 201);
  }
  if (resource === "reports" && segments[1] && segments[2] === "dismiss") {
    // ReportState.DISMISSED exists in the schema but nothing ever set it --
    // moderation-actions always requires a punitive action + resolves the
    // report as a side effect, leaving no way to close out a report that
    // turns out not to be a violation without faking an action against it.
    const moderator = await db.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!moderator || moderator.role === "USER")
      return apiError("FORBIDDEN", "Moderator permission is required.", 403);
    const parsed = await parseJson(
      request,
      z.object({ resolution: z.string().min(5).max(500) }),
    );
    if (!parsed.success)
      return apiError(
        "INVALID_REQUEST",
        "A resolution note is required to dismiss a report.",
        400,
        parsed.error.flatten(),
      );
    const result = await db.report.updateMany({
      where: { id: segments[1], state: { in: ["OPEN", "IN_REVIEW"] } },
      data: {
        state: "DISMISSED",
        resolution: parsed.data.resolution,
        assignedModeratorId: userId,
      },
    });
    if (!result.count)
      return apiError(
        "NOT_FOUND",
        "Report not found or already resolved.",
        404,
      );
    return apiSuccess({ dismissed: true });
  }
  if (resource === "reports") {
    const parsed = await parseJson(
      request,
      z.object({
        targetType: z.enum(["TAKE", "COMMENT", "USER"]),
        targetId: z.string().uuid(),
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
    const targetExists =
      parsed.data.targetType === "TAKE"
        ? await db.take.count({ where: { id: parsed.data.targetId } })
        : parsed.data.targetType === "COMMENT"
          ? await db.comment.count({ where: { id: parsed.data.targetId } })
          : await db.user.count({ where: { id: parsed.data.targetId } });
    if (!targetExists)
      return apiError("NOT_FOUND", "Report target not found.", 404);
    return apiSuccess(
      await db.report.create({ data: { reporterId: userId, ...parsed.data } }),
      201,
    );
  }
  if (resource === "moderation-actions") {
    const moderator = await db.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!moderator || moderator.role === "USER")
      return apiError("FORBIDDEN", "Moderator permission is required.", 403);
    const parsed = await parseJson(
      request,
      z.object({
        reportId: z.string().uuid().optional(),
        targetType: z.enum(["TAKE", "COMMENT", "USER"]),
        targetId: z.string().uuid(),
        action: z.enum([
          "REMOVE_CONTENT",
          "WARN_USER",
          "TEMPORARY_MUTE",
          "BAN_USER",
          "RESTORE_CONTENT",
        ]),
        reason: z.string().min(5).max(500),
        expiresAt: z.coerce.date().optional(),
      }),
    );
    if (!parsed.success)
      return apiError(
        "INVALID_REQUEST",
        "Invalid moderation action.",
        400,
        parsed.error.flatten(),
      );
    if (
      parsed.data.action === "TEMPORARY_MUTE" &&
      (!parsed.data.expiresAt || parsed.data.expiresAt <= new Date())
    )
      return apiError(
        "INVALID_REQUEST",
        "A future expiry is required for a temporary mute.",
        400,
      );
    if (
      ["REMOVE_CONTENT", "RESTORE_CONTENT"].includes(parsed.data.action) &&
      parsed.data.targetType === "USER"
    )
      return apiError(
        "INVALID_REQUEST",
        "That action requires a content target.",
        400,
      );
    const target = await resolveModerationTarget(
      parsed.data.targetType,
      parsed.data.targetId,
    );
    if (!target) return apiError("NOT_FOUND", "Target not found.", 404);
    if (
      ["WARN_USER", "TEMPORARY_MUTE", "BAN_USER"].includes(
        parsed.data.action,
      ) &&
      target.userId === userId
    )
      return apiError(
        "INVALID_REQUEST",
        "Moderators cannot restrict their own account.",
        400,
      );
    if (parsed.data.reportId) {
      const report = await db.report.findFirst({
        where: {
          id: parsed.data.reportId,
          targetType: parsed.data.targetType,
          targetId: parsed.data.targetId,
        },
        select: { id: true },
      });
      if (!report)
        return apiError(
          "INVALID_REQUEST",
          "The report does not match this target.",
          400,
        );
    }
    const action = await db.$transaction(async (transaction) => {
      const created = await transaction.moderationAction.create({
        data: { moderatorId: userId, ...parsed.data },
      });
      if (parsed.data.action === "REMOVE_CONTENT") {
        if (parsed.data.targetType === "TAKE")
          await transaction.take.update({
            where: { id: parsed.data.targetId },
            data: { status: "MODERATOR_REMOVED", deletedAt: new Date() },
          });
        if (parsed.data.targetType === "COMMENT")
          await transaction.comment.update({
            where: { id: parsed.data.targetId },
            data: { status: "MODERATOR_REMOVED", deletedAt: new Date() },
          });
      }
      if (parsed.data.action === "RESTORE_CONTENT") {
        if (parsed.data.targetType === "TAKE")
          await transaction.take.update({
            where: { id: parsed.data.targetId },
            data: { status: "ACTIVE", deletedAt: null },
          });
        if (parsed.data.targetType === "COMMENT")
          await transaction.comment.update({
            where: { id: parsed.data.targetId },
            data: { status: "ACTIVE", deletedAt: null },
          });
      }
      if (parsed.data.action === "TEMPORARY_MUTE")
        await transaction.user.update({
          where: { id: target.userId },
          data: { mutedUntil: parsed.data.expiresAt },
        });
      if (parsed.data.action === "BAN_USER")
        await transaction.user.update({
          where: { id: target.userId },
          data: { status: "SUSPENDED", bannedAt: new Date() },
        });
      if (["REMOVE_CONTENT", "BAN_USER"].includes(parsed.data.action)) {
        await transaction.fanScoreEvent.create({
          data: {
            userId: target.userId,
            eventType: "MODERATION_PENALTY",
            sourceType: parsed.data.targetType,
            sourceId: parsed.data.targetId,
            points: -25,
            reason: parsed.data.reason,
            idempotencyKey: `moderation-penalty:${created.id}`,
          },
        });
        await transaction.profile.upsert({
          where: { userId: target.userId },
          create: {
            userId: target.userId,
            favoriteSports: [],
            favoriteTeams: [],
            reputation: -25,
          },
          update: { reputation: { decrement: 25 } },
        });
      }
      if (parsed.data.action === "RESTORE_CONTENT") {
        const penalty = await transaction.fanScoreEvent.findFirst({
          where: {
            userId: target.userId,
            eventType: "MODERATION_PENALTY",
            sourceType: parsed.data.targetType,
            sourceId: parsed.data.targetId,
            reversalOfEventId: null,
          },
          orderBy: { occurredAt: "desc" },
        });
        if (
          penalty &&
          !(await transaction.fanScoreEvent.findUnique({
            where: { reversalOfEventId: penalty.id },
          }))
        ) {
          await transaction.fanScoreEvent.create({
            data: {
              userId: target.userId,
              eventType: "MODERATION_PENALTY_REVERSAL",
              sourceType: parsed.data.targetType,
              sourceId: parsed.data.targetId,
              points: -penalty.points,
              reason: `Restored: ${parsed.data.reason}`,
              idempotencyKey: `moderation-restore:${created.id}`,
              reversalOfEventId: penalty.id,
            },
          });
          await transaction.profile.update({
            where: { userId: target.userId },
            data: { reputation: { increment: -penalty.points } },
          });
        }
      }
      if (
        ["WARN_USER", "TEMPORARY_MUTE", "BAN_USER"].includes(parsed.data.action)
      )
        await transaction.notification.create({
          data: {
            recipientId: target.userId,
            actorId: userId,
            type: "MODERATION",
            entityType: parsed.data.targetType,
            entityId: parsed.data.targetId,
            href: "/notifications",
            payload: {
              action: parsed.data.action,
              reason: parsed.data.reason,
            },
          },
        });
      if (parsed.data.reportId)
        await transaction.report.update({
          where: { id: parsed.data.reportId },
          data: {
            state: "RESOLVED",
            resolution: parsed.data.reason,
            assignedModeratorId: userId,
          },
        });
      return created;
    });
    return apiSuccess(action, 201);
  }
  if (resource === "jobs" && segments[1] === "hall-of-flame") {
    const administrator = await db.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (administrator?.role !== "ADMIN")
      return apiError(
        "FORBIDDEN",
        "Administrator permission is required.",
        403,
      );
    const parsed = await parseJson(
      request,
      z.object({ period: z.enum(["DAILY", "WEEKLY", "MONTHLY", "ALL_TIME"]) }),
    );
    if (!parsed.success)
      return apiError(
        "INVALID_REQUEST",
        "Invalid ranking period.",
        400,
        parsed.error.flatten(),
      );
    return apiSuccess(await runHallOfFlameJob(db, parsed.data.period));
  }
  return apiError("NOT_FOUND", "API operation not found.", 404);
}

async function handlePatch(request: Request, context: Context) {
  const { segments } = await context.params;
  const actor = await mutationIdentity();
  if (actor.response) return actor.response;
  const userId = actor.userId;
  if (segments[0] === "profile") {
    const parsed = await parseJson(
      request,
      z.object({
        displayName: z.string().trim().min(2).max(50),
        bio: z.string().trim().max(300),
        favoriteSports: z.array(z.string().uuid()).max(10),
        favoriteTeams: z.array(z.string().uuid()).max(20),
        privacySettings: z
          .object({
            profileDiscoverable: z.boolean(),
            showActivity: z.boolean(),
          })
          .strict(),
      }),
    );
    if (!parsed.success)
      return apiError(
        "INVALID_REQUEST",
        "Invalid profile settings.",
        400,
        parsed.error.flatten(),
      );
    const [sportCount, teamCount] = await Promise.all([
      db.sport.count({ where: { id: { in: parsed.data.favoriteSports } } }),
      db.team.count({ where: { id: { in: parsed.data.favoriteTeams } } }),
    ]);
    if (
      sportCount !== new Set(parsed.data.favoriteSports).size ||
      teamCount !== new Set(parsed.data.favoriteTeams).size
    )
      return apiError(
        "INVALID_REQUEST",
        "One or more selected interests are unavailable.",
        400,
      );
    const user = await db.user.update({
      where: { id: userId },
      data: {
        displayName: parsed.data.displayName,
        profile: {
          upsert: {
            create: {
              bio: parsed.data.bio,
              favoriteSports: parsed.data.favoriteSports,
              favoriteTeams: parsed.data.favoriteTeams,
            },
            update: {
              bio: parsed.data.bio,
              favoriteSports: parsed.data.favoriteSports,
              favoriteTeams: parsed.data.favoriteTeams,
            },
          },
        },
        preferences: {
          upsert: {
            create: { privacySettings: parsed.data.privacySettings },
            update: { privacySettings: parsed.data.privacySettings },
          },
        },
      },
      select: {
        id: true,
        handle: true,
        displayName: true,
        image: true,
        profile: true,
        preferences: true,
      },
    });
    return apiSuccess(user);
  }
  if (segments[0] !== "takes" || !segments[1])
    return apiError("NOT_FOUND", "API operation not found.", 404);
  const rateLimit = await checkRateLimit(
    rateLimitKey(request, "takes:update", userId),
    rateLimitPolicy("takes:update"),
  );
  if (!rateLimit.allowed)
    return apiError(
      "RATE_LIMITED",
      "Please wait before trying again.",
      429,
      undefined,
      { "Retry-After": String(rateLimit.retryAfterSeconds) },
    );
  const parsed = await parseJson(
    request,
    z.object({ body: z.string().trim().min(1).max(1000) }),
  );
  if (!parsed.success)
    return apiError(
      "INVALID_REQUEST",
      "Invalid take.",
      400,
      parsed.error.flatten(),
    );
  const result = await db.take.updateMany({
    where: {
      id: segments[1],
      authorId: userId,
      status: ContentStatus.ACTIVE,
      createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
    },
    data: { body: parsed.data.body, editedAt: new Date() },
  });
  if (!result.count)
    return apiError("NOT_FOUND", "Editable take not found.", 404);
  return apiSuccess(
    await db.take.findUniqueOrThrow({ where: { id: segments[1] } }),
  );
}

async function handleDelete(_request: Request, context: Context) {
  const { segments } = await context.params;
  const actor = await mutationIdentity();
  if (actor.response) return actor.response;
  const userId = actor.userId;
  if (segments[0] === "takes" && segments[1]) {
    const result = await db.take.updateMany({
      where: {
        id: segments[1],
        authorId: userId,
        status: ContentStatus.ACTIVE,
      },
      data: {
        status: ContentStatus.AUTHOR_REMOVED,
        body: "",
        deletedAt: new Date(),
      },
    });
    if (!result.count)
      return apiError("NOT_FOUND", "Removable take not found.", 404);
    return apiSuccess({ removed: true });
  }
  if (segments[0] !== "account")
    return apiError("NOT_FOUND", "API operation not found.", 404);
  const pendingDeletionAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { status: "PENDING_DELETION", deletedAt: pendingDeletionAt },
    }),
    db.session.deleteMany({ where: { userId } }),
  ]);
  return apiSuccess({
    status: "PENDING_DELETION",
    effectiveAt: pendingDeletionAt.toISOString(),
  });
}

async function safely(operation: () => Promise<Response>): Promise<Response> {
  try {
    return await operation();
  } catch (error) {
    console.error("FanTakes API operation failed", {
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return apiError(
      "INTERNAL_ERROR",
      "The request could not be completed. Please try again.",
      500,
    );
  }
}

export function GET(request: Request, context: Context) {
  return safely(() => handleGet(request, context));
}

export function POST(request: Request, context: Context) {
  return safely(() => handlePost(request, context));
}

export function PATCH(request: Request, context: Context) {
  return safely(() => handlePatch(request, context));
}

export function DELETE(request: Request, context: Context) {
  return safely(() => handleDelete(request, context));
}
