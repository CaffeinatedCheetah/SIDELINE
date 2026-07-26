import { randomUUID } from "node:crypto";

import { db } from "@/lib/db/client";
import { recordFanScoreEvent } from "@/lib/scoring/fan-score";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({
  userId: undefined as string | undefined,
}));

vi.mock("@/auth", () => ({
  auth: async () =>
    authState.userId
      ? { user: { id: authState.userId, email: "integration@fantakes.local" } }
      : null,
}));

import { DELETE, PATCH, POST } from "@/app/api/v1/[...segments]/route";

const runDatabaseTests = process.env.RUN_DATABASE_TESTS === "true";
const databaseDescribe = runDatabaseTests ? describe : describe.skip;

vi.setConfig({ hookTimeout: 120_000, testTimeout: 120_000 });

type JsonBody = { data?: unknown; error?: { code: string; message: string } };

function context(path: string) {
  return {
    params: Promise.resolve({
      segments: path.split("/").filter(Boolean),
    }),
  };
}

async function request(
  method: "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
) {
  const input = new Request(`http://localhost/api/v1/${path}`, {
    method,
    headers:
      body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const response =
    method === "POST"
      ? await POST(input, context(path))
      : method === "PATCH"
        ? await PATCH(input, context(path))
        : await DELETE(input, context(path));
  return {
    status: response.status,
    body: (await response.json()) as JsonBody,
  };
}

databaseDescribe.sequential("PostgreSQL-backed critical flows", () => {
  const suffix = randomUUID().slice(0, 8);
  const ids = {
    user: "",
    secondUser: "",
    moderator: "",
    deletionUser: "",
    community: "",
    futureGame: "",
    liveGame: "",
    take: "",
    reply: "",
    gameTake: "",
    debate: "",
    poll: "",
    report: "",
    reportTarget: "",
  };

  beforeAll(async () => {
    const users = await Promise.all(
      [
        ["user", "Integration Fan"],
        ["second", "Second Fan"],
        ["moderator", "Safety Moderator"],
        ["delete", "Deletion Fan"],
      ].map(([kind, displayName]) =>
        db.user.create({
          data: {
            email: `${kind}-${suffix}@fantakes.local`,
            emailVerified: new Date(),
            handle: `${kind}-${suffix}`,
            normalizedHandle: `${kind}-${suffix}`,
            displayName,
            onboardedAt: new Date(),
          },
        }),
      ),
    );
    [ids.user, ids.secondUser, ids.moderator, ids.deletionUser] = users.map(
      (user) => user.id,
    );
    await db.user.update({
      where: { id: ids.moderator },
      data: { role: "ADMIN" },
    });
    const community = await db.community.findUniqueOrThrow({
      where: { slug: "motor-city-faithful" },
    });
    ids.community = community.id;
    const games = await db.game.findMany({ orderBy: { scheduledAt: "asc" } });
    ids.liveGame = games.find((game) => game.status === "LIVE")?.id ?? "";
    ids.futureGame =
      games.find((game) => game.status === "SCHEDULED")?.id ?? "";
  });

  afterAll(async () => {
    authState.userId = undefined;
    const testUsers = [
      ids.user,
      ids.secondUser,
      ids.moderator,
      ids.deletionUser,
    ].filter(Boolean);
    const testTakes = [
      ids.take,
      ids.reply,
      ids.gameTake,
      ids.reportTarget,
    ].filter(Boolean);
    await db.hallOfFlameEntry.deleteMany({
      where: {
        OR: [
          { period: "ALL_TIME" },
          ...(testTakes.length ? [{ takeId: { in: testTakes } }] : []),
        ],
      },
    });
    await db.moderationAction.deleteMany({
      where: { moderatorId: { in: testUsers } },
    });
    await db.report.deleteMany({ where: { reporterId: { in: testUsers } } });
    await db.notification.deleteMany({
      where: {
        OR: [
          { recipientId: { in: testUsers } },
          { actorId: { in: testUsers } },
        ],
      },
    });
    await db.fanScoreEvent.deleteMany({ where: { userId: { in: testUsers } } });
    await db.rateLimitBucket.deleteMany({
      where: {
        OR: testUsers.map((userId) => ({
          key: { startsWith: `user:${userId}:` },
        })),
      },
    });
    await db.savedItem.deleteMany({ where: { userId: { in: testUsers } } });
    await db.pollVote.deleteMany({ where: { userId: { in: testUsers } } });
    if (ids.poll) await db.poll.deleteMany({ where: { id: ids.poll } });
    await db.vote.deleteMany({ where: { userId: { in: testUsers } } });
    await db.reaction.deleteMany({ where: { userId: { in: testUsers } } });
    await db.comment.deleteMany({ where: { authorId: { in: testUsers } } });
    await db.prediction.deleteMany({ where: { userId: { in: testUsers } } });
    await db.follow.deleteMany({
      where: {
        OR: [
          { followerId: { in: testUsers } },
          { followedId: { in: testUsers } },
        ],
      },
    });
    if (testTakes.length)
      await db.take.deleteMany({ where: { id: { in: testTakes } } });
    if (ids.debate) await db.debate.deleteMany({ where: { id: ids.debate } });
    await db.communityMember.deleteMany({
      where: { userId: { in: testUsers } },
    });
    await db.user.deleteMany({ where: { id: { in: testUsers } } });
    await db.$disconnect();
  });

  it("rejects unauthenticated mutations", async () => {
    authState.userId = undefined;
    expect(
      (
        await request("POST", "follows", {
          userId: ids.secondUser,
          follow: true,
        })
      ).status,
    ).toBe(401);
  });

  it("persists onboarding, profile fields, interests, and privacy", async () => {
    authState.userId = ids.user;
    const sport = await db.sport.findFirstOrThrow();
    const team = await db.team.findFirstOrThrow();
    const complete = await request("POST", "profile/complete", {
      displayName: "Integration Fan",
      handle: `verified-${suffix}`,
      favoriteSports: [sport.id],
      favoriteTeams: [team.id],
    });
    expect(complete.status).toBe(201);

    const update = await request("PATCH", "profile", {
      displayName: "Persistent Fan",
      bio: "Database-backed profile",
      favoriteSports: [sport.id],
      favoriteTeams: [team.id],
      privacySettings: {
        profileDiscoverable: true,
        showActivity: false,
      },
    });
    expect(update.status).toBe(200);
    const persisted = await db.user.findUniqueOrThrow({
      where: { id: ids.user },
      include: { profile: true, preferences: true },
    });
    expect(persisted.displayName).toBe("Persistent Fan");
    expect(persisted.profile?.bio).toBe("Database-backed profile");
    expect(persisted.profile?.favoriteSports).toEqual([sport.id]);
    expect(persisted.preferences?.privacySettings).toEqual({
      profileDiscoverable: true,
      showActivity: false,
    });
  });

  it("joins, updates, leaves, and rejoins a community without duplicates", async () => {
    authState.userId = ids.user;
    expect(
      (
        await request("POST", "community-membership", {
          communityId: ids.community,
          join: true,
          notifications: true,
        })
      ).status,
    ).toBe(201);
    await request("POST", "community-membership", {
      communityId: ids.community,
      join: true,
      notifications: false,
    });
    expect(
      await db.communityMember.count({
        where: { communityId: ids.community, userId: ids.user },
      }),
    ).toBe(1);
    expect(
      (
        await db.communityMember.findUniqueOrThrow({
          where: {
            communityId_userId: {
              communityId: ids.community,
              userId: ids.user,
            },
          },
        })
      ).notifications,
    ).toBe(false);
    await request("POST", "community-membership", {
      communityId: ids.community,
      join: false,
    });
    expect(
      await db.communityMember.count({
        where: { communityId: ids.community, userId: ids.user },
      }),
    ).toBe(0);
    const rejoined = await request("POST", "community-membership", {
      communityId: ids.community,
      join: true,
      notifications: true,
    });
    expect(rejoined.status).toBe(201);
    expect(
      await db.communityMember.count({
        where: { communityId: ids.community, userId: ids.user },
      }),
    ).toBe(1);
  });

  it("creates, edits, replies to, votes on, saves, reacts to, and removes takes", async () => {
    authState.userId = ids.user;
    await db.communityMember.upsert({
      where: {
        communityId_userId: {
          communityId: ids.community,
          userId: ids.user,
        },
      },
      update: { status: "ACTIVE" },
      create: {
        communityId: ids.community,
        userId: ids.user,
        rulesAcceptedAt: new Date(),
      },
    });
    const created = await request("POST", "takes", {
      body: "A database-backed community take.",
      communityId: ids.community,
    });
    expect(created.status).toBe(201);
    ids.take = (created.body.data as { id: string }).id;
    const reply = await request("POST", "takes", {
      body: "A persisted reply.",
      communityId: ids.community,
      parentId: ids.take,
    });
    ids.reply = (reply.body.data as { id: string }).id;

    authState.userId = ids.secondUser;
    expect(
      (
        await request("PATCH", `takes/${ids.take}`, {
          body: "Unauthorized edit.",
        })
      ).status,
    ).toBe(404);
    const agree = await request("POST", "votes", {
      takeId: ids.take,
      kind: "AGREE",
    });
    expect(agree.status).toBe(200);
    await request("POST", "votes", { takeId: ids.take, kind: "DISAGREE" });
    expect(await db.vote.count({ where: { takeId: ids.take } })).toBe(1);
    await request("POST", "reactions", { takeId: ids.take, kind: "FIRE" });
    await request("POST", "saved-items", {
      kind: "TAKE",
      entityId: ids.take,
      save: true,
    });
    expect(
      await db.savedItem.count({
        where: { userId: ids.secondUser, takeId: ids.take },
      }),
    ).toBe(1);
    await request("POST", "saved-items", {
      kind: "TAKE",
      entityId: ids.take,
      save: false,
    });

    authState.userId = ids.user;
    expect(
      (
        await request("PATCH", `takes/${ids.take}`, {
          body: "An edited database-backed take.",
        })
      ).status,
    ).toBe(200);
    expect((await request("DELETE", `takes/${ids.reply}`)).status).toBe(200);
    expect(
      (await db.take.findUniqueOrThrow({ where: { id: ids.reply } })).status,
    ).toBe("AUTHOR_REMOVED");
  });

  it("posts in a game room and enforces prediction locks", async () => {
    authState.userId = ids.user;
    const gameTake = await request("POST", "takes", {
      body: "Live game-room participation.",
      gameId: ids.liveGame,
    });
    ids.gameTake = (gameTake.body.data as { id: string }).id;
    expect(gameTake.status).toBe(201);
    expect(
      (
        await request("POST", "predictions", {
          gameId: ids.liveGame,
          selection: "home",
          idempotencyKey: `locked-${suffix}`,
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await request("POST", "predictions", {
          gameId: ids.futureGame,
          selection: "home",
          idempotencyKey: `future-${suffix}`,
        })
      ).status,
    ).toBe(201);
    await request("POST", "predictions", {
      gameId: ids.futureGame,
      selection: "away",
      idempotencyKey: `future-${suffix}`,
    });
    expect(
      await db.prediction.count({
        where: { gameId: ids.futureGame, userId: ids.user },
      }),
    ).toBe(1);
  });

  it("creates debates and derives vote totals server-side", async () => {
    authState.userId = ids.user;
    await db.communityMember.upsert({
      where: {
        communityId_userId: {
          communityId: ids.community,
          userId: ids.user,
        },
      },
      update: { status: "ACTIVE" },
      create: {
        communityId: ids.community,
        userId: ids.user,
        rulesAcceptedAt: new Date(),
      },
    });
    const created = await request("POST", "debates", {
      title: "Which defense controls this integration game?",
      prompt: "Compare execution and explain the deciding matchup in detail.",
      slug: `integration-debate-${suffix}`,
      options: ["Home defense", "Away defense"],
      communityId: ids.community,
    });
    expect(created.status).toBe(201);
    const debate = created.body.data as {
      id: string;
      options: { id: string }[];
    };
    ids.debate = debate.id;
    authState.userId = ids.secondUser;
    const vote = await request("POST", "votes", {
      debateId: ids.debate,
      optionId: debate.options[0].id,
    });
    expect(vote.status).toBe(201);
    expect((vote.body.data as { total: number }).total).toBe(1);
    expect(
      (
        vote.body.data as {
          results: { votes: number; percentage: number }[];
        }
      ).results,
    ).toEqual([
      { optionId: debate.options[0].id, votes: 1, percentage: 100 },
      { optionId: debate.options[1].id, votes: 0, percentage: 0 },
    ]);
    expect(
      (
        await request("POST", "votes", {
          debateId: ids.debate,
          optionId: debate.options[1].id,
        })
      ).status,
    ).toBe(409);
  });

  it("creates polls and prevents duplicate votes", async () => {
    authState.userId = ids.user;
    const created = await request("POST", "polls", {
      question: "Who wins this matchup?",
      options: ["Home", "Away"],
      gameId: ids.futureGame,
    });
    expect(created.status).toBe(201);
    const poll = created.body.data as { id: string; options: { id: string }[] };
    ids.poll = poll.id;
    authState.userId = ids.secondUser;
    expect(
      (
        await request("POST", "poll-votes", {
          pollId: ids.poll,
          optionId: poll.options[0].id,
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await request("POST", "poll-votes", {
          pollId: ids.poll,
          optionId: poll.options[1].id,
        })
      ).status,
    ).toBe(409);
  });

  it("persists follows, notifications, unread state, and unfollows", async () => {
    authState.userId = ids.user;
    expect(
      (
        await request("POST", "follows", {
          userId: ids.secondUser,
          follow: true,
        })
      ).status,
    ).toBe(201);
    expect(
      await db.follow.count({
        where: { followerId: ids.user, followedId: ids.secondUser },
      }),
    ).toBe(1);
    const notification = await db.notification.findFirstOrThrow({
      where: { recipientId: ids.secondUser, actorId: ids.user, type: "FOLLOW" },
    });
    expect(notification.readAt).toBeNull();
    authState.userId = ids.secondUser;
    expect(
      (
        await request("POST", "notifications/read", {
          notificationId: notification.id,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await db.notification.findUniqueOrThrow({
          where: { id: notification.id },
        })
      ).readAt,
    ).not.toBeNull();
    authState.userId = ids.user;
    await request("POST", "follows", {
      userId: ids.secondUser,
      follow: false,
    });
    expect(
      await db.follow.count({
        where: { followerId: ids.user, followedId: ids.secondUser },
      }),
    ).toBe(0);
  });

  it("blocking ends a mutual follow, and muting/unblocking round-trip cleanly", async () => {
    authState.userId = ids.user;
    await request("POST", "follows", {
      userId: ids.secondUser,
      follow: true,
    });
    authState.userId = ids.secondUser;
    await request("POST", "follows", { userId: ids.user, follow: true });
    expect(
      await db.follow.count({
        where: {
          OR: [
            { followerId: ids.user, followedId: ids.secondUser },
            { followerId: ids.secondUser, followedId: ids.user },
          ],
        },
      }),
    ).toBe(2);

    authState.userId = ids.user;
    expect(
      (await request("POST", "blocks", { userId: ids.secondUser, block: true }))
        .status,
    ).toBe(201);
    expect(
      await db.block.count({
        where: { blockerId: ids.user, blockedId: ids.secondUser },
      }),
    ).toBe(1);
    // Blocking must end any mutual follow in both directions -- doc:
    // "block confirms and immediately hides interaction."
    expect(
      await db.follow.count({
        where: {
          OR: [
            { followerId: ids.user, followedId: ids.secondUser },
            { followerId: ids.secondUser, followedId: ids.user },
          ],
        },
      }),
    ).toBe(0);

    expect(
      (await request("POST", "mutes", { userId: ids.secondUser, mute: true }))
        .status,
    ).toBe(201);
    expect(
      await db.mute.count({
        where: {
          userId: ids.user,
          targetType: "USER",
          targetId: ids.secondUser,
        },
      }),
    ).toBe(1);

    await request("POST", "blocks", {
      userId: ids.secondUser,
      block: false,
    });
    await request("POST", "mutes", { userId: ids.secondUser, mute: false });
    expect(
      await db.block.count({
        where: { blockerId: ids.user, blockedId: ids.secondUser },
      }),
    ).toBe(0);
    expect(
      await db.mute.count({
        where: {
          userId: ids.user,
          targetType: "USER",
          targetId: ids.secondUser,
        },
      }),
    ).toBe(0);
  });

  it("keeps Fan Score events idempotent and generates deterministic Hall entries", async () => {
    await recordFanScoreEvent(db, {
      userId: ids.user,
      type: "QUALITY_TAKE",
      sourceType: "INTEGRATION",
      sourceId: suffix,
      idempotencyKey: `integration-score:${suffix}`,
      reason: "Integration idempotency verification",
    });
    await recordFanScoreEvent(db, {
      userId: ids.user,
      type: "QUALITY_TAKE",
      sourceType: "INTEGRATION",
      sourceId: suffix,
      idempotencyKey: `integration-score:${suffix}`,
      reason: "Integration idempotency verification",
    });
    expect(
      await db.fanScoreEvent.count({
        where: { idempotencyKey: `integration-score:${suffix}` },
      }),
    ).toBe(1);
    authState.userId = ids.moderator;
    const first = await request("POST", "jobs/hall-of-flame", {
      period: "ALL_TIME",
    });
    const second = await request("POST", "jobs/hall-of-flame", {
      period: "ALL_TIME",
    });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(
      (
        first.body.data as { takeId: string; rank: number; score: string }[]
      ).map(({ takeId, rank, score }) => ({
        takeId,
        rank,
        score: String(score),
      })),
    ).toEqual(
      (
        second.body.data as { takeId: string; rank: number; score: string }[]
      ).map(({ takeId, rank, score }) => ({
        takeId,
        rank,
        score: String(score),
      })),
    );
  });

  it("enforces moderation roles, content state, warnings, mutes, and bans", async () => {
    const reportTarget = await db.take.create({
      data: {
        authorId: ids.secondUser,
        body: "Disposable moderation integration target.",
      },
    });
    ids.reportTarget = reportTarget.id;
    authState.userId = ids.user;
    const report = await request("POST", "reports", {
      targetType: "TAKE",
      targetId: ids.reportTarget,
      reason: "HARASSMENT",
      detail: "Integration report.",
    });
    expect(report.status).toBe(201);
    ids.report = (report.body.data as { id: string }).id;
    expect(
      (
        await request("POST", "moderation-actions", {
          reportId: ids.report,
          targetType: "TAKE",
          targetId: ids.reportTarget,
          action: "WARN_USER",
          reason: "Normal users cannot perform this action.",
        })
      ).status,
    ).toBe(403);
    authState.userId = ids.moderator;
    expect(
      (
        await request("POST", "moderation-actions", {
          reportId: ids.report,
          targetType: "TAKE",
          targetId: ids.reportTarget,
          action: "WARN_USER",
          reason: "Documented integration warning.",
        })
      ).status,
    ).toBe(201);
    expect(
      await db.moderationAction.count({
        where: { reportId: ids.report, moderatorId: ids.moderator },
      }),
    ).toBe(1);
    expect(
      (
        await db.notification.findFirstOrThrow({
          where: {
            recipientId: ids.secondUser,
            type: "MODERATION",
          },
          orderBy: { createdAt: "desc" },
        })
      ).payload,
    ).toMatchObject({ action: "WARN_USER" });

    expect(
      (
        await request("POST", "moderation-actions", {
          targetType: "TAKE",
          targetId: ids.reportTarget,
          action: "REMOVE_CONTENT",
          reason: "Remove the reported integration content.",
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await db.take.findUniqueOrThrow({
          where: { id: ids.reportTarget },
        })
      ).status,
    ).toBe("MODERATOR_REMOVED");
    expect(
      (
        await request("POST", "moderation-actions", {
          targetType: "TAKE",
          targetId: ids.reportTarget,
          action: "RESTORE_CONTENT",
          reason: "Restore after the integration review.",
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await db.take.findUniqueOrThrow({
          where: { id: ids.reportTarget },
        })
      ).status,
    ).toBe("ACTIVE");

    const mutedUntil = new Date(Date.now() + 60_000);
    expect(
      (
        await request("POST", "moderation-actions", {
          targetType: "USER",
          targetId: ids.secondUser,
          action: "TEMPORARY_MUTE",
          reason: "Temporary integration safety restriction.",
          expiresAt: mutedUntil.toISOString(),
        })
      ).status,
    ).toBe(201);
    authState.userId = ids.secondUser;
    expect(
      (
        await request("POST", "reports", {
          targetType: "TAKE",
          targetId: ids.reportTarget,
          reason: "HARASSMENT",
        })
      ).status,
    ).toBe(403);
    await db.user.update({
      where: { id: ids.secondUser },
      data: { mutedUntil: null },
    });

    authState.userId = ids.moderator;
    expect(
      (
        await request("POST", "moderation-actions", {
          targetType: "USER",
          targetId: ids.secondUser,
          action: "BAN_USER",
          reason: "Integration ban enforcement verification.",
        })
      ).status,
    ).toBe(201);
    authState.userId = ids.secondUser;
    expect(
      (
        await request("POST", "reports", {
          targetType: "TAKE",
          targetId: ids.reportTarget,
          reason: "HARASSMENT",
        })
      ).status,
    ).toBe(403);
    await db.user.update({
      where: { id: ids.secondUser },
      data: { status: "ACTIVE", bannedAt: null },
    });
  });

  it("starts account deletion and blocks subsequent mutations", async () => {
    authState.userId = ids.deletionUser;
    expect((await request("DELETE", "account")).status).toBe(200);
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: ids.deletionUser } }))
        .status,
    ).toBe("PENDING_DELETION");
    expect(
      (
        await request("POST", "follows", {
          userId: ids.secondUser,
          follow: true,
        })
      ).status,
    ).toBe(403);
  });
});
