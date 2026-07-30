import type { Metadata } from "next";
import { Radio, Trophy, Users } from "lucide-react";

import { auth } from "@/auth";
import { GameCard } from "@/components/games/game-card";
import { LeagueCard } from "@/components/leagues/league-card";
import { EmptyState } from "@/components/ui/foundations";
import { getLeagueHub } from "@/lib/db/league-hub";
import { gameStatusLabel } from "@/lib/sports/read-model";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Explore leagues",
  description:
    "Follow teams, find live games, and join conversations across SIDELINE.",
};

export default async function LeaguesPage() {
  const session = await auth();
  const hub = await getLeagueHub(session?.user?.id);
  const liveCount = hub.liveGameCount;

  return (
    <div className="page-container min-w-0 py-10 md:py-14">
      <header className="border-border-subtle bg-surface-2 relative overflow-hidden rounded-2xl border p-6 shadow-xl md:p-8">
        <div
          aria-hidden
          className="bg-brand/15 absolute -top-32 right-0 size-72 rounded-full blur-3xl"
        />
        <div className="relative max-w-3xl">
          <p className="text-brand text-sm font-bold tracking-[0.18em] uppercase">
            SIDELINE sports universe
          </p>
          <h1 className="font-display mt-2 text-5xl leading-none font-black tracking-tight md:text-6xl">
            Explore leagues
          </h1>
          <p className="text-text-secondary mt-4 text-lg">
            Follow teams, find live games, and join the conversation across
            every sport on SIDELINE.
          </p>
          <dl className="mt-6 flex flex-wrap gap-3">
            <Stat
              icon={Trophy}
              label="Supported leagues"
              value={hub.leagues.length}
            />
            <Stat icon={Radio} label="Live games" value={liveCount} />
            {session?.user?.id ? (
              <Stat
                icon={Users}
                label="Followed teams"
                value={hub.followedTeamCount}
              />
            ) : null}
          </dl>
        </div>
      </header>

      <section className="mt-12" aria-labelledby="league-directory-title">
        <h2
          id="league-directory-title"
          className="font-display text-3xl font-black"
        >
          Every league
        </h2>
        <p className="text-text-secondary mt-2">
          One shared live experience, shaped for each sport.
        </p>
        <div className="mt-6 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {hub.leagues.map((league) => (
            <LeagueCard key={league.key} league={league} />
          ))}
        </div>
      </section>

      <section className="mt-14" aria-labelledby="live-across-title">
        <div className="flex items-center gap-2">
          <Radio
            aria-hidden
            className="text-success size-5 motion-safe:animate-pulse"
          />
          <h2
            id="live-across-title"
            className="font-display text-3xl font-black"
          >
            Live across SIDELINE
          </h2>
        </div>
        {hub.liveGames.length ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {hub.liveGames.map((game) => (
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
                statusText={gameStatusLabel(game)}
                scheduledAt={game.scheduledAt.toISOString()}
                conversationCount={game._count.takes}
                followerCount={game._count.follows}
              />
            ))}
          </div>
        ) : (
          <div className="mt-6">
            <EmptyState
              title="Nothing live right now"
              description="Upcoming games and active conversations are still available."
            />
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Trophy;
  label: string;
  value: number;
}) {
  return (
    <div className="border-border-subtle bg-surface-1/70 flex items-center gap-2 rounded-full border px-3 py-2">
      <Icon aria-hidden className="text-brand size-4" />
      <dt className="text-text-muted text-xs">{label}</dt>
      <dd className="font-black tabular-nums">{value}</dd>
    </div>
  );
}
