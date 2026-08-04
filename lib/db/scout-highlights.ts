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
  options: Array<{ key: string; label: string }>;
};

export type ScoutHighlightGame = {
  id: string;
  leagueAbbreviation: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  homeScore: number | null;
  awayScore: number | null;
  status: GameStatus;
  statusDetail: string | null;
  scheduledAt: string;
};

export type ScoutHighlights = {
  takes: ScoutHighlightTake[];
  debate: ScoutHighlightDebate | null;
  games: ScoutHighlightGame[];
};

async function getScoutUserId(): Promise<string | null> {
  const user = await db.user.findFirst({
    where: {
      OR: [{ email: SCOUT_EMAIL }, { handle: SCOUT_HANDLE }],
    },
    select: { id: true },
  });
  return user?.id ?? null;
}

export async function getScoutHighlights(): Promise<ScoutHighlights> {
  const empty: ScoutHighlights = { takes: [], debate: null, games: [] };

  const scoutId = await getScoutUserId();
  if (!scoutId) return empty;

  const since = new Date(Date.now() - 48 * 60 * 60 * 1000); // last 48h

  const [takes, debate, games] = await Promise.all([
    db.take
      .findMany({
        where: { authorId: scoutId, createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          body: true,
          createdAt: true,
          _count: { select: { comments: true, reactions: true } },
        },
      })
      .then((rows) =>
        rows.map((r) => ({
          id: r.id,
          body: r.body,
          createdAt: r.createdAt,
          reactions: r._count.reactions,
          replies: r._count.comments,
        })),
      ),

    db.debate
      .findFirst({
        where: {
          creatorId: scoutId,
          status: "OPEN",
          createdAt: { gte: since },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          slug: true,
          title: true,
          prompt: true,
          createdAt: true,
          _count: { select: { votes: true } },
          options: {
            select: { key: true, label: true },
            orderBy: { displayOrder: "asc" },
          },
        },
      })
      .then((d) =>
        d
          ? {
              id: d.id,
              slug: d.slug,
              title: d.title,
              prompt: d.prompt,
              createdAt: d.createdAt,
              replies: d._count.votes,
              options: d.options,
            }
          : null,
      ),

    db.game
      .findMany({
        where: {
          status: { in: ["LIVE", "SCHEDULED"] },
          scheduledAt: { gte: new Date() },
        },
        orderBy: { scheduledAt: "asc" },
        take: 4,
        include: {
          league: { select: { abbreviation: true } },
          homeTeam: { select: { name: true, logoUrl: true } },
          awayTeam: { select: { name: true, logoUrl: true } },
        },
      })
      .then((rows) =>
        rows.map((g) => ({
          id: g.id,
          leagueAbbreviation: g.league.abbreviation,
          homeTeam: g.homeTeam.name,
          awayTeam: g.awayTeam.name,
          homeTeamLogo: g.homeTeam.logoUrl,
          awayTeamLogo: g.awayTeam.logoUrl,
          homeScore: g.homeScore,
          awayScore: g.awayScore,
          status: g.status,
          statusDetail: g.statusDetail,
          scheduledAt: g.scheduledAt.toISOString(),
        })),
      ),
  ]);

  return { takes, debate, games };
}
