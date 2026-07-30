import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Radio, Users } from "lucide-react";

import { auth } from "@/auth";
import { GameCard } from "@/components/games/game-card";
import { LeagueMark } from "@/components/leagues/league-mark";
import { TeamCard } from "@/components/teams/team-card";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/foundations";
import { getLeagueOverview } from "@/lib/db/league-hub";
import { gameStatusLabel } from "@/lib/sports/read-model";
import { leagueTheme, shortLeagueLabel } from "@/lib/sports/presentation";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ leagueSlug: string }>;
}): Promise<Metadata> {
  const { leagueSlug } = await params;
  const overview = await getLeagueOverview(leagueSlug);
  if (!overview) return { title: "League not found" };
  return {
    title: overview.league.name,
    description: `Live games, teams, and fan conversations from ${overview.league.name}.`,
  };
}

export default async function LeaguePage({
  params,
}: {
  params: Promise<{ leagueSlug: string }>;
}) {
  const { leagueSlug } = await params;
  const session = await auth();
  const overview = await getLeagueOverview(leagueSlug, session?.user?.id);
  if (!overview) notFound();
  const { league, teams, followedTeamIds } = overview;
  const featured =
    overview.liveGames[0] ??
    overview.upcomingGames[0] ??
    overview.finalGames[0];
  const additionalGameCount =
    overview.liveGames.length +
    overview.upcomingGames.length +
    overview.finalGames.length -
    (featured ? 1 : 0);

  return (
    <div
      className="page-container min-w-0 py-10 md:py-14"
      style={leagueTheme(league.key)}
    >
      <header className="border-border-subtle relative overflow-hidden rounded-2xl border bg-[linear-gradient(145deg,var(--league-soft),var(--surface-2)_65%)] p-6 shadow-xl md:p-8">
        <div
          aria-hidden
          className="absolute -top-28 -right-20 size-72 rounded-full bg-[var(--league-glow)] blur-3xl"
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <LeagueMark
            abbreviation={shortLeagueLabel(league)}
            sportKey={league.sportKey}
            className="size-20"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold tracking-[0.18em] text-[color:var(--league-secondary)] uppercase">
              {league.sportName}
            </p>
            <h1 className="font-display mt-1 text-4xl leading-none font-black tracking-tight text-balance md:text-6xl">
              {league.name}
            </h1>
            <div className="text-text-secondary mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <span className="flex items-center gap-2">
                <Users aria-hidden className="size-4" />
                {teams.length} teams
              </span>
              <span className="flex items-center gap-2">
                <Radio
                  aria-hidden
                  className={
                    overview.liveGames.length
                      ? "text-success motion-safe:animate-pulse"
                      : ""
                  }
                />
                {overview.liveGames.length} live
              </span>
              {session?.user?.id ? (
                <span>{followedTeamIds.size} followed</span>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <nav
        aria-label={`${league.name} sections`}
        className="border-border-subtle bg-surface-1/90 sticky top-16 z-20 mt-6 flex gap-1 overflow-x-auto rounded-xl border p-1.5 backdrop-blur"
      >
        {[
          ["Overview", "#overview"],
          ["Games", "#games"],
          ["Teams", "#teams"],
        ].map(([label, href]) => (
          <Link
            key={href}
            href={href}
            className="hover:bg-surface-3 focus-visible:outline-brand min-h-10 shrink-0 rounded-lg px-4 py-2 text-sm font-bold"
          >
            {label}
          </Link>
        ))}
      </nav>

      <div id="overview" className="mt-10 grid gap-14">
        <section aria-labelledby="featured-game-title">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold tracking-[0.16em] text-[color:var(--league-secondary)] uppercase">
                {overview.liveGames.length
                  ? "Live now"
                  : overview.upcomingGames.length
                    ? "Up next"
                    : "Latest result"}
              </p>
              <h2
                id="featured-game-title"
                className="font-display text-3xl font-black"
              >
                Featured game
              </h2>
            </div>
            <Link
              href={`/games?tab=${encodeURIComponent(league.abbreviation)}`}
              className={buttonStyles({ variant: "secondary" })}
            >
              View league games
            </Link>
          </div>
          {featured ? (
            <div className="max-w-2xl">
              <LeagueGameCard game={featured} featured />
            </div>
          ) : (
            <EmptyState
              title="No games in this window"
              description="Try another date or explore teams from this league."
            />
          )}
        </section>

        {additionalGameCount ? (
          <section id="games" aria-labelledby="league-games-title">
            <h2
              id="league-games-title"
              className="font-display text-3xl font-black"
            >
              League games
            </h2>
            <div className="mt-6 grid gap-10">
              <GameGroup
                title="Live"
                games={overview.liveGames.filter(
                  (game) => game.id !== featured?.id,
                )}
              />
              <GameGroup
                title="Upcoming"
                games={overview.upcomingGames.filter(
                  (game) => game.id !== featured?.id,
                )}
              />
              <GameGroup
                title="Final"
                games={overview.finalGames.filter(
                  (game) => game.id !== featured?.id,
                )}
              />
            </div>
          </section>
        ) : null}

        <section id="teams" aria-labelledby="league-teams-title">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2
                id="league-teams-title"
                className="font-display text-3xl font-black"
              >
                Teams
              </h2>
              <p className="text-text-secondary mt-1">
                Follow teams to bring this league into My SIDELINE.
              </p>
            </div>
            <Link
              href="/teams"
              className="text-brand font-bold hover:underline"
            >
              Manage all teams
            </Link>
          </div>
          {teams.length ? (
            <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {teams.map((team) => (
                <TeamCard
                  key={team.id}
                  team={team}
                  following={followedTeamIds.has(team.id)}
                  signedIn={Boolean(session?.user?.id)}
                  callbackUrl={`/leagues/${league.key}`}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="Teams are not synchronized yet"
              description="Verified team records will appear after this league has synchronized a schedule."
            />
          )}
        </section>
      </div>
    </div>
  );
}

type LeagueGame = NonNullable<
  Awaited<ReturnType<typeof getLeagueOverview>>
>["liveGames"][number];

function LeagueGameCard({
  game,
  featured = false,
}: {
  game: LeagueGame;
  featured?: boolean;
}) {
  return (
    <GameCard
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
      statusText={gameStatusLabel(game)}
      scheduledAt={game.scheduledAt.toISOString()}
      broadcast={game.broadcast ?? undefined}
      conversationCount={game._count.takes}
      followerCount={game._count.follows}
      featured={featured}
    />
  );
}

function GameGroup({ title, games }: { title: string; games: LeagueGame[] }) {
  if (!games.length) return null;
  return (
    <div>
      <h3 className="text-text-secondary mb-4 text-sm font-black tracking-[0.14em] uppercase">
        {title}
      </h3>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {games.map((game) => (
          <LeagueGameCard key={game.id} game={game} />
        ))}
      </div>
    </div>
  );
}
