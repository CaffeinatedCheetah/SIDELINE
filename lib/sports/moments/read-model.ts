import { db } from "@/lib/db/client";

const takeInclude = {
  author: { select: { handle: true, displayName: true, image: true } },
  _count: { select: { reactions: true, replies: true, votes: true } },
} as const;

export async function getGameMoments(gameId: string) {
  const game = await db.game.findUnique({
    where: { id: gameId },
    select: { status: true },
  });
  if (!game) return null;
  return db.gameMoment.findMany({
    where: { gameId },
    orderBy: {
      occurredAt: game.status === "FINAL" ? "asc" : "desc",
    },
    include: {
      flashThread: {
        select: {
          id: true,
          status: true,
          _count: { select: { takes: true } },
        },
      },
    },
  });
}

export async function getGameFlashThreads(gameId: string) {
  const game = await db.game.findUnique({
    where: { id: gameId },
    select: { id: true, status: true },
  });
  if (!game) return null;
  const threads = await db.flashThread.findMany({
    where: { gameId },
    orderBy: {
      moment: { occurredAt: game.status === "FINAL" ? "asc" : "desc" },
    },
    include: {
      moment: true,
      takes: {
        where: { status: "ACTIVE", parentId: null },
        orderBy: { createdAt: "desc" },
        include: takeInclude,
      },
    },
  });
  return threads.map((thread) => ({
    ...thread,
    takeCount: thread.takes.length,
    reactionCount: thread.takes.reduce(
      (total, take) => total + take._count.reactions + take._count.votes,
      0,
    ),
    replyCount: thread.takes.reduce(
      (total, take) => total + take._count.replies,
      0,
    ),
  }));
}

export function getFlashThread(threadId: string) {
  return db.flashThread.findUnique({
    where: { id: threadId },
    include: {
      game: {
        include: { homeTeam: true, awayTeam: true, league: true },
      },
      moment: true,
      takes: {
        where: { status: "ACTIVE", parentId: null },
        orderBy: { createdAt: "desc" },
        include: takeInclude,
      },
    },
  });
}
