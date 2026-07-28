import type { Metadata } from "next";
import Link from "next/link";
import { GameCard } from "@/components/games/game-card";
import { LiveAutoRefresh } from "@/components/games/live-auto-refresh";
import { PageHeading } from "@/components/layout/page-heading";
import { EmptyState } from "@/components/ui/foundations";
import { SUPPORTED_LEAGUES } from "@/lib/sports/leagues";
import {
  gameStatusLabel,
  getSportsGameDirectory,
} from "@/lib/sports/read-model";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Games",
  description: "Live, upcoming, and final games across every major sport.",
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SPORT_TABS = [
  "ALL",
  ...SUPPORTED_LEAGUES.map((league) => league.abbreviation),
];

function toDateParam(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfDay(dateParam: string | undefined) {
  const base =
    dateParam && DATE_PATTERN.test(dateParam)
      ? new Date(`${dateParam}T00:00:00Z`)
      : new Date();
  return new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()),
  );
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
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
  searchParams: Promise<{ tab?: string; date?: string }>;
}) {
  const filters = await searchParams;
  const tab = SPORT_TABS.includes(filters.tab ?? "")
    ? (filters.tab ?? "ALL")
    : "ALL";
  const leagueKey =
    tab === "ALL"
      ? undefined
      : SUPPORTED_LEAGUES.find((league) => league.abbreviation === tab)?.key;
  const day = startOfDay(filters.date);
  const today = startOfDay(undefined);
  const yesterdayParam = toDateParam(addDays(today, -1));
  const tomorrowParam = toDateParam(addDays(today, 1));
  const isToday = toDateParam(day) === toDateParam(today);
  const isYesterday = toDateParam(day) === yesterdayParam;
  const isTomorrow = toDateParam(day) === tomorrowParam;
  const dateParam = toDateParam(day);

  const directory = await getSportsGameDirectory({
    date: dateParam,
    leagueKey,
  });
  const games = directory.games;
  const hasLive = games.some((game) => game.status === "LIVE");

  const dateLabel = day.toLocaleDateString(undefined, {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const dateTabs: { label: string; param: string | undefined; active: boolean }[] = [
    { label: "Yesterday", param: yesterdayParam, active: isYesterday },
    { label: "Today", param: undefined, active: isToday },
    { label: "Tomorrow", param: tomorrowParam, active: isTomorrow },
  ];

  return (
    <div className="page-container py-10">
      <LiveAutoRefresh active={hasLive} />
      <PageHeading
        eyebrow="The scoreboard is the front door"
        title="Games"
        description="Find what is live, what starts next, and where fans are talking."
      />
      <nav aria-label="Sport" className="mb-5 flex flex-wrap gap-1">
        {SPORT_TABS.map((sport) => (
          <Link
            key={sport}
            href={buildQuery({ tab: sport === "ALL" ? undefined : sport, date: filters.date })}
            aria-current={tab === sport ? "page" : undefined}
            className={`min-h-9 rounded-sm px-3 py-1.5 text-sm font-bold ${
              tab === sport
                ? "bg-brand-surface text-brand-light"
                : "text-text-secondary hover:bg-surface-3"
            }`}
          >
            {sport}
          </Link>
        ))}
      </nav>
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <Link
          href={buildQuery({ tab: filters.tab, date: toDateParam(addDays(day, -1)) })}
          aria-label="Previous day"
          className="border-border-strong bg-surface-2 hover:bg-surface-3 grid min-h-11 min-w-11 place-items-center rounded-sm border font-bold"
        >
          ←
        </Link>
        <nav aria-label="Date" className="flex gap-1">
          {dateTabs.map(({ label, param, active }) => (
            <Link
              key={label}
              href={buildQuery({ tab: filters.tab, date: param })}
              aria-current={active ? "page" : undefined}
              className={`min-h-11 rounded-sm px-3 py-2 text-sm font-bold ${
                active
                  ? "bg-brand-surface text-brand-light"
                  : "text-text-secondary hover:bg-surface-3"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
        {!isToday && !isYesterday && !isTomorrow && (
          <span className="font-display text-lg font-black">{dateLabel}</span>
        )}
        <Link
          href={buildQuery({ tab: filters.tab, date: toDateParam(addDays(day, 1)) })}
          aria-label="Next day"
          className="border-border-strong bg-surface-2 hover:bg-surface-3 grid min-h-11 min-w-11 place-items-center rounded-sm border font-bold"
        >
          →
        </Link>
      </div>
      {games.length ? (
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
              homeScore={game.homeScore}
              awayScore={game.awayScore}
              status={game.status}
              scheduledAt={game.scheduledAt.toISOString()}
              broadcast={game.broadcast ?? undefined}
              statusText={gameStatusLabel(game)}
              conversationCount={game._count.takes}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title={
            directory.providerError
              ? "Schedules could not refresh"
              : isToday
                ? "No games today"
                : `No games on ${dateLabel}`
          }
          description={
            directory.providerError
              ? "No synchronized schedule is available yet. Try again shortly."
              : "Try another day or sport."
          }
        />
      )}
    </div>
  );
}
