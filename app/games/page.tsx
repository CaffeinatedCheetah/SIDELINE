import type { Metadata } from "next";
import Link from "next/link";
import { GameCard } from "@/components/games/game-card";
import { PageHeading } from "@/components/layout/page-heading";
import { EmptyState, ErrorState } from "@/components/ui/foundations";
import { Select } from "@/components/ui/form-controls";
import { db } from "@/lib/db/client";
import { withTimeout } from "@/lib/db/with-timeout";
import type { Prisma } from "@prisma/client";

type GameListItem = Prisma.GameGetPayload<{
  include: {
    league: true;
    homeTeam: true;
    awayTeam: true;
    _count: { select: { takes: true } };
  };
}>;
type LeagueOption = Prisma.LeagueGetPayload<{
  select: { key: true; abbreviation: true; name: true };
}>;

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Games",
  description: "Live, upcoming, and final sports games.",
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function dayBounds(dateParam: string | undefined) {
  const base =
    dateParam && DATE_PATTERN.test(dateParam)
      ? new Date(`${dateParam}T00:00:00Z`)
      : new Date();
  const startOfDay = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()),
  );
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
  return { startOfDay, endOfDay };
}

function toDateParam(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildQuery(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `/games?${query}` : "/games";
}

export default async function GamesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; league?: string; date?: string }>;
}) {
  const filters = await searchParams;
  const { startOfDay, endOfDay } = dayBounds(filters.date);
  const isToday = toDateParam(startOfDay) === toDateParam(new Date());
  const previousDate = toDateParam(
    new Date(startOfDay.getTime() - 24 * 60 * 60 * 1000),
  );
  const nextDate = toDateParam(
    new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000),
  );

  let games: GameListItem[] = [];
  let leagues: LeagueOption[] = [];
  let failed = false;
  try {
    [games, leagues] = await withTimeout(
      Promise.all([
        db.game.findMany({
          where: {
            scheduledAt: { gte: startOfDay, lt: endOfDay },
            ...(filters.status &&
            ["LIVE", "SCHEDULED", "FINAL", "POSTPONED", "CANCELED"].includes(
              filters.status,
            )
              ? {
                  status: filters.status as GameListItem["status"],
                }
              : {}),
            ...(filters.league ? { league: { key: filters.league } } : {}),
          },
          take: 60,
          orderBy: { scheduledAt: "asc" },
          include: {
            league: true,
            homeTeam: true,
            awayTeam: true,
            _count: { select: { takes: true } },
          },
        }),
        db.league.findMany({
          where: { active: true },
          orderBy: { name: "asc" },
          select: { key: true, abbreviation: true, name: true },
        }),
      ]),
      "GamesPage.findMany",
    );
  } catch (error) {
    failed = true;
    console.error(
      "[GamesPage] query failed:",
      error instanceof Error ? `${error.name}: ${error.message}` : error,
    );
  }

  const dateLabel = startOfDay.toLocaleDateString(undefined, {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="page-container py-10">
      <PageHeading
        eyebrow="The scoreboard is the front door"
        title="Games"
        description="Find what is live, what starts next, and where fans are talking."
      />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          href={buildQuery({ ...filters, date: previousDate })}
          className="border-border-strong bg-surface-2 hover:bg-surface-3 min-h-11 rounded-sm border px-3 text-sm font-bold"
        >
          ← Previous day
        </Link>
        <span className="font-display text-lg font-black">
          {isToday ? "Today" : dateLabel}
        </span>
        <Link
          href={buildQuery({ ...filters, date: nextDate })}
          className="border-border-strong bg-surface-2 hover:bg-surface-3 min-h-11 rounded-sm border px-3 text-sm font-bold"
        >
          Next day →
        </Link>
        {!isToday && (
          <Link
            href={buildQuery({ ...filters, date: undefined })}
            className="text-brand font-bold hover:underline"
          >
            Jump to today
          </Link>
        )}
      </div>
      <form className="border-border-subtle bg-surface-1 mb-8 grid gap-3 rounded-md border p-4 sm:grid-cols-3">
        <input type="hidden" name="date" value={filters.date ?? ""} />
        <label className="grid gap-2 text-sm font-bold">
          Status
          <Select name="status" defaultValue={filters.status ?? ""}>
            <option value="">All games</option>
            <option value="LIVE">Live</option>
            <option value="SCHEDULED">Upcoming</option>
            <option value="FINAL">Final</option>
            <option value="POSTPONED">Postponed</option>
            <option value="CANCELED">Canceled</option>
          </Select>
        </label>
        <label className="grid gap-2 text-sm font-bold">
          League
          <Select name="league" defaultValue={filters.league ?? ""}>
            <option value="">All leagues</option>
            {leagues.map((league) => (
              <option key={league.key} value={league.key}>
                {league.abbreviation}
              </option>
            ))}
          </Select>
        </label>
        <button className="bg-brand min-h-11 self-end rounded-sm px-4 font-bold">
          Apply filters
        </button>
      </form>
      {failed ? (
        <ErrorState
          title="Games are unavailable"
          description="We couldn't load the schedule right now. Try again shortly."
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
              homeTeamLogo={game.homeTeam.logoUrl ?? undefined}
              awayTeamLogo={game.awayTeam.logoUrl ?? undefined}
              homeScore={game.homeScore ?? undefined}
              awayScore={game.awayScore ?? undefined}
              status={game.status}
              scheduledAt={game.scheduledAt.toISOString()}
              statusText={
                game.status === "LIVE"
                  ? `${game.period ?? "Live"} ${game.clock ?? ""}`.trim()
                  : game.status
              }
              conversationCount={game._count.takes}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title={isToday ? "No games today" : `No games on ${dateLabel}`}
          description="Try another day, status, or league."
        />
      )}
    </div>
  );
}
