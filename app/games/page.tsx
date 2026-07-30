import type { Metadata } from "next";
import Link from "next/link";
import { Radio, SlidersHorizontal } from "lucide-react";
import { auth } from "@/auth";
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
  searchParams: Promise<{
    tab?: string;
    date?: string;
    state?: string;
    scope?: string;
  }>;
}) {
  const filters = await searchParams;
  const session = await auth();
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

  const [directory, followedTeams] = await Promise.all([
    getSportsGameDirectory({
      date: dateParam,
      leagueKey,
    }),
    session?.user?.id
      ? import("@/lib/db/client").then(({ db }) =>
          db.teamFollow.findMany({
            where: { userId: session.user.id },
            select: {
              team: { select: { name: true, abbreviation: true } },
            },
            take: 100,
          }),
        )
      : Promise.resolve([]),
  ]);
  const followedKeys = new Set(
    followedTeams.flatMap(({ team }) => [
      team.name.toLowerCase(),
      team.abbreviation.toLowerCase(),
    ]),
  );
  const state =
    filters.state === "LIVE" ||
    filters.state === "UPCOMING" ||
    filters.state === "FINAL"
      ? filters.state
      : "ALL";
  const myTeams = filters.scope === "mine" && Boolean(session?.user?.id);
  const games = directory.games.filter((game) => {
    if (
      myTeams &&
      ![
        game.homeTeam.name,
        game.homeTeam.abbreviation,
        game.awayTeam.name,
        game.awayTeam.abbreviation,
      ].some((value) => followedKeys.has(value.toLowerCase()))
    )
      return false;
    if (state === "LIVE")
      return game.status === "LIVE" || game.status === "HALFTIME";
    if (state === "UPCOMING")
      return game.status === "SCHEDULED" || game.status === "PREGAME";
    if (state === "FINAL") return game.status === "FINAL";
    return true;
  });
  const hasLive = games.some((game) => game.status === "LIVE");

  const dateLabel = day.toLocaleDateString(undefined, {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const dateTabs: {
    label: string;
    param: string | undefined;
    active: boolean;
  }[] = [
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
      <div className="border-border-subtle bg-surface-2 mb-6 rounded-2xl border p-3 shadow-lg md:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-text-secondary flex items-center gap-2 text-sm font-bold">
            <SlidersHorizontal aria-hidden className="size-4" />
            League
          </span>
          <Link
            href="/leagues"
            className="text-brand text-sm font-bold hover:underline"
          >
            Explore leagues
          </Link>
        </div>
        <nav aria-label="Sport" className="flex flex-wrap gap-1">
          {SPORT_TABS.map((sport) => (
            <Link
              key={sport}
              href={buildQuery({
                tab: sport === "ALL" ? undefined : sport,
                date: filters.date,
                state: filters.state,
                scope: filters.scope,
              })}
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
        {session?.user?.id ? (
          <div className="border-border-subtle mt-3 border-t pt-3">
            <Link
              href={buildQuery({
                tab: filters.tab,
                date: filters.date,
                state: filters.state,
                scope: myTeams ? undefined : "mine",
              })}
              aria-pressed={myTeams}
              className={`inline-flex min-h-9 items-center rounded-full border px-3 py-1.5 text-xs font-bold ${
                myTeams
                  ? "border-brand bg-brand-surface text-brand-light"
                  : "border-border-subtle text-text-secondary hover:bg-surface-3"
              }`}
            >
              {myTeams ? "✓ " : ""}My Teams
            </Link>
          </div>
        ) : null}
      </div>
      <nav aria-label="Game state" className="mb-5 flex flex-wrap gap-2">
        {[
          ["ALL", "All games"],
          ["LIVE", "Live"],
          ["UPCOMING", "Upcoming"],
          ["FINAL", "Final"],
        ].map(([value, label]) => (
          <Link
            key={value}
            href={buildQuery({
              tab: filters.tab,
              date: filters.date,
              state: value === "ALL" ? undefined : value,
              scope: filters.scope,
            })}
            aria-current={state === value ? "page" : undefined}
            className={`flex min-h-10 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-bold ${
              state === value
                ? "border-brand bg-brand-surface text-brand-light"
                : "border-border-subtle bg-surface-2 text-text-secondary hover:bg-surface-3"
            }`}
          >
            {value === "LIVE" ? (
              <Radio
                aria-hidden
                className="text-success size-3.5 motion-safe:animate-pulse"
              />
            ) : null}
            {label}
          </Link>
        ))}
      </nav>
      <div className="mb-8 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:flex-wrap sm:gap-3">
        <Link
          href={buildQuery({
            tab: filters.tab,
            date: toDateParam(addDays(day, -1)),
            state: filters.state,
            scope: filters.scope,
          })}
          aria-label="Previous day"
          className="border-border-strong bg-surface-2 hover:bg-surface-3 grid min-h-11 min-w-11 place-items-center rounded-sm border font-bold"
        >
          ←
        </Link>
        <nav
          aria-label="Date"
          className="grid min-w-0 grid-cols-3 gap-1 sm:flex"
        >
          {dateTabs.map(({ label, param, active }) => (
            <Link
              key={label}
              href={buildQuery({
                tab: filters.tab,
                date: param,
                state: filters.state,
                scope: filters.scope,
              })}
              aria-current={active ? "page" : undefined}
              className={`min-h-11 min-w-0 rounded-sm px-2 py-2 text-center text-sm font-bold sm:px-3 ${
                active
                  ? "bg-brand-surface text-brand-light"
                  : "text-text-secondary hover:bg-surface-3"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <Link
          href={buildQuery({
            tab: filters.tab,
            date: toDateParam(addDays(day, 1)),
            state: filters.state,
            scope: filters.scope,
          })}
          aria-label="Next day"
          className="border-border-strong bg-surface-2 hover:bg-surface-3 grid min-h-11 min-w-11 place-items-center rounded-sm border font-bold"
        >
          →
        </Link>
        {!isToday && !isYesterday && !isTomorrow && (
          <span className="font-display col-span-3 text-center text-lg font-black">
            {dateLabel}
          </span>
        )}
      </div>
      {games.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {games.map((game) => (
            <GameCard
              key={game.id}
              id={game.id}
              league={game.league.abbreviation}
              leagueKey={game.league.key}
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
              followerCount={game._count.follows}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title={
            directory.providerError
              ? "Schedules could not refresh"
              : myTeams
                ? "No favorites here yet"
                : isToday
                  ? "No games in this window"
                  : `No games on ${dateLabel}`
          }
          description={
            directory.providerError
              ? "No synchronized schedule is available yet. Try again shortly."
              : myTeams
                ? "Follow a team to add this league to My SIDELINE."
                : "Try another date or explore teams from this league."
          }
        />
      )}
    </div>
  );
}
