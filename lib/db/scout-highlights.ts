import type { GameStatus } from "@prisma/client";

import { db } from "@/lib/db/client";

const SCOUT_EMAIL = "scout@fantakes.local";
const SCOUT_HANDLE = "fantakes-bot";

export type ScoutHighlightTake = {
  id: string;
  body: string;
  createdAt: Date;
  reactions: number;
  replies: number;
};

export type ScoutHighlightDebate = {
  id: string;
  slug: string;
  title: string;
  prompt: string;
  createdAt: Date;
  replies: number;
  options: Array<{ label: string; votes: number }>;
};

export type ScoutHighlightGame = {
  id: string;
  league: { abbreviation: string; key: string };
  homeTeam: { name: string; abbreviation: string; logoUrl: string | null };
  awayTeam: { name: string; abbreviation: string; logoUrl: string | null };
  homeScore: number | null;
  awayScore: number | null;
  status: GameStatus;
  statusText: string;
  scheduledAt: Date;
  broadcast: string | null;
  conversations: number;
  followers: number;
};

export type ScoutHighlights = {
  topStory: ScoutHighlightTake | null;
  trendingTopics: ScoutHighlightTake[];
  suggestedDebate: ScoutHighlightDebate | null;
  trendingMatchup: ScoutHighlightGame | null;
  failed: boolean;
};

function engagementScore(item: Pick<ScoutHighlightTake, "reactions" | "replies">) {
  return item.reactions * 2 + item.replies * 3;
}

export async function getScoutHighlights(): Promise<ScoutHighlights> {
  try {
    const scout = await db.user.findFirst({
      where: {
        OR: [{ email: SCOUT_EMAIL }, { normalizedHandle: SCOUT_HANDLE }],
      },
      select: { id: true },
    });
    if (!scout) {
      return {
        topStory: null,
        trendingTopics: [],
        suggestedDebate: null,
        trendingMatchup: null,
        failed: false,
      };
    }

    const [takes, debate, game] = await Promise.all([
      db.take.findMany({
        where: { authorId: scout.id, status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          body: true,
          createdAt: true,
          _count: { select: { reactions: true, replies: true } },
        },
      }),
      db.debate.findFirst({
        where: { creatorId: scout.id, status: "OPEN" },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          slug: true,
          title: true,
          prompt: true,
          createdAt: true,
          options: {
            orderBy: { displayOrder: "asc" },
            select: {
              label: true,
              _count: { select: { votes: true } },
            },
          },
          _count: { select: { comments: true } },
        },
      }),
      db.game.findMany({
        where: {
          status: { in: ["LIVE", "HALFTIME", "PREGAME", "SCHEDULED", "FINAL"] },
        },
        orderBy: { scheduledAt: "desc" },
        take: 8,
        select: {
          id: true,
          status: true,
          statusDetail: true,
          scheduledAt: true,
          broadcast: true,
          homeScore: true,
          awayScore: true,
          league: { select: { abbreviation: true, key: true } },
          homeTeam: {
            select: { name: true, abbreviation: true, logoUrl: true },
          },
          awayTeam: {
            select: { name: true, abbreviation: true, logoUrl: true },
          },
          _count: { select: { takes: true, follows: true } },
        },
      }),
    ]);

    const sortedTakes = takes
      .map((take) => ({
        id: take.id,
        body: take.body,
        createdAt: take.createdAt,
        reactions: take._count.reactions,
        replies: take._count.replies,
      }))
      .sort((left, right) => {
        const scoreDifference = engagementScore(right) - engagementScore(left);
        if (scoreDifference !== 0) return scoreDifference;
        return right.createdAt.getTime() - left.createdAt.getTime();
      });
    const trendingGame = [...game].sort((left, right) => {
      const scoreDifference =
        right._count.takes * 2 +
        right._count.follows * 3 -
        (left._count.takes * 2 + left._count.follows * 3);
      if (scoreDifference !== 0) return scoreDifference;
      return right.scheduledAt.getTime() - left.scheduledAt.getTime();
    })[0];

    return {
      topStory: sortedTakes[0] ?? null,
      trendingTopics: sortedTakes.slice(0, 3),
      suggestedDebate: debate
        ? {
            id: debate.id,
            slug: debate.slug,
            title: debate.title,
            prompt: debate.prompt,
            createdAt: debate.createdAt,
            replies: debate._count.comments,
            options: debate.options.map((option) => ({
              label: option.label,
              votes: option._count.votes,
            })),
          }
        : null,
      trendingMatchup: trendingGame
        ? {
            id: trendingGame.id,
            league: trendingGame.league,
            homeTeam: trendingGame.homeTeam,
            awayTeam: trendingGame.awayTeam,
            homeScore: trendingGame.homeScore,
            awayScore: trendingGame.awayScore,
            status: trendingGame.status,
            statusText:
              trendingGame.statusDetail ??
              (trendingGame.status === "LIVE" ? "Live" : trendingGame.status),
            scheduledAt: trendingGame.scheduledAt,
            broadcast: trendingGame.broadcast,
            conversations: trendingGame._count.takes,
            followers: trendingGame._count.follows,
          }
        : null,
      failed: false,
    };
  } catch {
    return {
      topStory: null,
      trendingTopics: [],
      suggestedDebate: null,
      trendingMatchup: null,
      failed: true,
    };
  }
}
