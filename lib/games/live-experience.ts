import { Prisma, type GameStatus } from "@prisma/client";

import { db } from "@/lib/db/client";
import { getGameFlashThreads, getGameMoments } from "@/lib/sports/moments/read-model";

export type LiveFeedKind = "moment" | "thread" | "take" | "prediction" | "milestone";

export type LiveFeedItem = {
  id: string;
  kind: LiveFeedKind;
  title: string;
  detail?: string | null;
  timestamp: string;
  importance: number;
  featured?: boolean;
  score?: {
    away: number | null;
    home: number | null;
  };
  status?: string | null;
  href?: string | null;
};

export type LivePrediction = {
  id: string;
  selection: string;
  status: "OPEN" | "LOCKED" | "RESOLVED" | "CANCELED";
  locksAt: string;
  submittedAt: string;
  resolvedAt: string | null;
  resolvedSelection: string | null;
  outcome: "CORRECT" | "INCORRECT" | "VOID" | null;
  user: {
    handle: string;
    displayName: string;
    image: string | null;
  };
};

export type LiveTake = {
  id: string;
  body: string;
  createdAt: string;
  author: {
    handle: string;
    displayName: string;
    image: string | null;
  };
  reactions: number;
  replies: number;
  votes: number;
};

export type LiveExperience = {
  activePredictionCount: number;
  flashThreadCount: number;
  moments: Awaited<ReturnType<typeof getGameMoments>>;
  flashThreads: Awaited<ReturnType<typeof getGameFlashThreads>>;
  predictions: LivePrediction[];
  topTakes: LiveTake[];
  activity: LiveFeedItem[];
};

function countEngagement(take: {
  reactions: number;
  replies: number;
  votes: number;
  createdAt: Date;
}) {
  return (
    take.reactions * 2 +
    take.replies * 2 +
    take.votes +
    Math.max(0, 100 - Math.floor((Date.now() - take.createdAt.getTime()) / 60_000))
  );
}

function predictionLabel(selection: string) {
  if (selection === "home") return "picked the home team";
  if (selection === "away") return "picked the away team";
  return `picked ${selection}`;
}

function predictionOutcomeLabel(
  outcome: LivePrediction["outcome"],
  resolvedSelection: string | null,
) {
  if (!outcome) return "Open";
  if (outcome === "VOID") return "Void";
  return outcome === "CORRECT"
    ? `Correct · ${resolvedSelection ?? "resolved"}`
    : `Incorrect · ${resolvedSelection ?? "resolved"}`;
}

export async function getGameLiveExperience(gameId: string) {
  const game = await db.game.findUnique({
    where: { id: gameId },
    select: {
      id: true,
      status: true,
      league: { select: { key: true } },
      homeTeam: { select: { name: true, abbreviation: true } },
      awayTeam: { select: { name: true, abbreviation: true } },
    },
  });
  if (!game) return null;

  const [momentsResult, flashThreadsResult, predictions, topTakes] =
    await Promise.all([
      getGameMoments(gameId),
      getGameFlashThreads(gameId),
      db.prediction.findMany({
      where: { gameId },
      orderBy: [{ submittedAt: "desc" }],
      take: 8,
      select: {
        id: true,
        selection: true,
        status: true,
        locksAt: true,
        submittedAt: true,
        result: {
          select: { outcome: true, resolvedSelection: true, resolvedAt: true },
        },
        user: { select: { handle: true, displayName: true, image: true } },
      },
    }),
    db.take.findMany({
      where: { gameId, status: "ACTIVE", parentId: null },
      orderBy: [{ createdAt: "desc" }],
      take: 8,
      select: {
        id: true,
        body: true,
        createdAt: true,
        author: { select: { handle: true, displayName: true, image: true } },
        _count: { select: { reactions: true, replies: true, votes: true } },
      },
    }),
    ]);
  const moments = momentsResult ?? [];
  const flashThreads = flashThreadsResult ?? [];

  const predictionIds = predictions.map((prediction) => prediction.id);
  const takeIds = topTakes.map((take) => take.id);
  const fanMomentumConditions: Prisma.FanScoreEventWhereInput[] = [];
  if (takeIds.length)
    fanMomentumConditions.push({
      sourceType: "TAKE",
      sourceId: { in: takeIds },
    });
  if (predictionIds.length)
    fanMomentumConditions.push({
      sourceType: "PREDICTION",
      sourceId: { in: predictionIds },
    });
  const fanMomentumEvents =
    fanMomentumConditions.length
      ? await db.fanScoreEvent.findMany({
          where: { OR: fanMomentumConditions },
          orderBy: { occurredAt: "desc" },
          take: 8,
          include: {
            user: { select: { handle: true, displayName: true } },
          },
        })
      : [];

  const activePredictionCount = predictions.filter(
    (prediction) => prediction.status === "OPEN" || prediction.status === "LOCKED",
  ).length;
  const flashThreadCount = flashThreads?.length ?? 0;
  const featuredThread = flashThreads?.[0] ?? null;

  const activity: LiveFeedItem[] = [
    ...(featuredThread
      ? [
          {
            id: `thread:${featuredThread.id}`,
            kind: "thread" as const,
            title: featuredThread.title,
            detail: `${featuredThread.takeCount} takes · ${featuredThread.reactionCount} reactions · ${featuredThread.replyCount} replies`,
            timestamp:
              featuredThread.createdAt?.toISOString() ??
              featuredThread.moment.occurredAt.toISOString(),
            importance: featuredThread.moment.importance,
            featured: true,
            score: {
              away: featuredThread.moment.awayScore,
              home: featuredThread.moment.homeScore,
            },
            status: featuredThread.status,
            href: `/games/${gameId}`,
          },
        ]
      : []),
    ...moments
      .filter((moment) => !moment.flashThread)
      .map((moment) => ({
        id: `moment:${moment.id}`,
        kind: "moment" as const,
        title: moment.title,
        detail: moment.description,
        timestamp: moment.occurredAt.toISOString(),
        importance: moment.importance,
        score: {
          away: moment.awayScore,
          home: moment.homeScore,
        },
        status: moment.type,
        href: `/games/${gameId}`,
      })),
    ...topTakes.map((take) => ({
      id: `take:${take.id}`,
      kind: "take" as const,
      title: `Top Take by ${take.author.displayName}`,
      detail: take.body,
      timestamp: take.createdAt.toISOString(),
      importance: countEngagement({
        reactions: take._count.reactions,
        replies: take._count.replies,
        votes: take._count.votes,
        createdAt: take.createdAt,
      }),
      href: `/games/${gameId}`,
    })),
    ...predictions.map((prediction) => {
      const outcome = prediction.result?.outcome ?? null;
      const resolvedSelection = prediction.result?.resolvedSelection ?? null;
      return {
        id: `prediction:${prediction.id}`,
        kind: "prediction" as const,
        title: `${prediction.user.displayName} ${predictionLabel(prediction.selection)}`,
        detail: predictionOutcomeLabel(outcome, resolvedSelection),
        timestamp: (
          prediction.result?.resolvedAt ?? prediction.submittedAt
        ).toISOString(),
        importance: outcome === "CORRECT" ? 95 : outcome === "INCORRECT" ? 65 : 40,
        status: prediction.status,
        href: `/games/${gameId}`,
      };
    }),
    ...fanMomentumEvents.map((event) => ({
      id: `milestone:${event.id}`,
      kind: "milestone" as const,
      title: `${event.user.displayName} earned ${Math.abs(event.points)} XP`,
      detail: event.reason,
      timestamp: event.occurredAt.toISOString(),
      importance: Math.abs(event.points) * 10,
      href: `/u/${event.user.handle}`,
    })),
  ].sort((left, right) => {
    const difference =
      new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime();
    if (difference !== 0) return difference;
    return right.importance - left.importance;
  });

  return {
    game: {
      id: game.id,
      status: game.status as GameStatus,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
    },
    activePredictionCount,
    flashThreadCount,
    moments,
    flashThreads,
    predictions: predictions.map((prediction) => ({
      id: prediction.id,
      selection: prediction.selection,
      status: prediction.status,
      locksAt: prediction.locksAt.toISOString(),
      submittedAt: prediction.submittedAt.toISOString(),
      resolvedAt: prediction.result?.resolvedAt?.toISOString() ?? null,
      resolvedSelection: prediction.result?.resolvedSelection ?? null,
      outcome: prediction.result?.outcome ?? null,
      user: prediction.user,
    })) satisfies LivePrediction[],
    topTakes: topTakes.map((take) => ({
      id: take.id,
      body: take.body,
      createdAt: take.createdAt.toISOString(),
      author: take.author,
      reactions: take._count.reactions,
      replies: take._count.replies,
      votes: take._count.votes,
    })) satisfies LiveTake[],
    activity,
  };
}
