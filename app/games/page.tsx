import type { Metadata } from "next";
import { GameCard } from "@/components/games/game-card";
import { PageHeading } from "@/components/layout/page-heading";
import { EmptyState } from "@/components/ui/foundations";
import { Select } from "@/components/ui/form-controls";
import { db } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";

type GameListItem = Prisma.GameGetPayload<{
  include: {
    league: true;
    homeTeam: true;
    awayTeam: true;
    _count: { select: { takes: true } };
  };
}>;

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Games",
  description: "Live, upcoming, and final sports games.",
};

export default async function GamesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; league?: string }>;
}) {
  const filters = await searchParams;
  let games: GameListItem[] = [];
  let dbError = false;
  try {
    games = (await db.game.findMany({
      where: {
        ...(filters.status &&
        ["LIVE", "SCHEDULED", "FINAL"].includes(filters.status)
          ? { status: filters.status as "LIVE" | "SCHEDULED" | "FINAL" }
          : {}),
        ...(filters.league ? { league: { key: filters.league } } : {}),
      },
      orderBy: { scheduledAt: "asc" },
      include: {
        league: true,
        homeTeam: true,
        awayTeam: true,
        _count: { select: { takes: true } },
      },
    })) as typeof games;
  } catch (error) {
    dbError = true;
    console.error("[GamesPage] failed to load games:", error);
  }
  return (
    <div className="page-container py-10">
      <PageHeading
        eyebrow="The scoreboard is the front door"
        title="Games"
        description="Find what is live, what starts next, and where fans are talking."
      />
      <form className="border-border-subtle bg-surface-1 mb-8 grid gap-3 rounded-md border p-4 sm:grid-cols-3">
        <label className="grid gap-2 text-sm font-bold">
          Status
          <Select name="status" defaultValue={filters.status ?? ""}>
            <option value="">All games</option>
            <option value="LIVE">Live</option>
            <option value="SCHEDULED">Upcoming</option>
            <option value="FINAL">Final</option>
          </Select>
        </label>
        <label className="grid gap-2 text-sm font-bold">
          League
          <Select name="league" defaultValue={filters.league ?? ""}>
            <option value="">All leagues</option>
            <option value="nfl">NFL</option>
            <option value="nba">NBA</option>
          </Select>
        </label>
        <button className="bg-brand min-h-11 self-end rounded-sm px-4 font-bold">
          Apply filters
        </button>
      </form>
      {dbError ? (
        <EmptyState
          title="Something went wrong loading games"
          description="We couldn't reach the database. Try refreshing in a moment."
        />
      ) : games.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {games.map((game) => (
            <GameCard
              key={game.id}
              id={game.id}
              league={game.league.abbreviation}
              homeTeam={game.homeTeam.name}
              awayTeam={game.awayTeam.name}
              homeScore={game.homeScore ?? undefined}
              awayScore={game.awayScore ?? undefined}
              status={game.status}
              statusText={game.status}
              conversationCount={game._count.takes}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No games match"
          description="Try another status or league."
        />
      )}
    </div>
  );
}
