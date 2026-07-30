import Link from "next/link";
import { Radio, Sparkles } from "lucide-react";

import { GameCard } from "@/components/games/game-card";
import { TeamCard } from "@/components/teams/team-card";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/foundations";
import type { MySidelineGame } from "@/lib/db/my-sideline";
import { gameStatusLabel } from "@/lib/sports/read-model";

type Team = {
  id: string;
  name: string;
  abbreviation: string;
  logoUrl: string | null;
  primaryColor: string | null;
  league: { key: string; abbreviation: string };
};

type FlashThread = {
  id: string;
  title: string;
  status: string;
  game: {
    id: string;
    homeTeam: { name: string };
    awayTeam: { name: string };
  };
  moment: {
    type: string;
    period: string | null;
    clock: string | null;
    homeScore: number | null;
    awayScore: number | null;
  };
  _count: { takes: number };
};

export function MySidelineSection({
  signedIn,
  teams,
  liveGames,
  upcomingGames,
  recentGames,
  flashThreads,
}: {
  signedIn: boolean;
  teams: Team[];
  liveGames: MySidelineGame[];
  upcomingGames: MySidelineGame[];
  recentGames: MySidelineGame[];
  flashThreads: FlashThread[];
}) {
  if (!signedIn) {
    return (
      <section aria-labelledby="my-sideline-heading">
        <h2
          id="my-sideline-heading"
          className="font-display mb-5 text-3xl font-black"
        >
          My SIDELINE
        </h2>
        <EmptyState
          title="Make SIDELINE yours"
          description="Sign in and follow teams to build a personalized game-day feed."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/auth/sign-in?callbackUrl=%2F"
                className={buttonStyles()}
              >
                Sign in
              </Link>
              <Link
                href="/teams"
                className={buttonStyles({ variant: "secondary" })}
              >
                Browse teams
              </Link>
            </div>
          }
        />
      </section>
    );
  }

  if (!teams.length) {
    return (
      <section aria-labelledby="my-sideline-heading">
        <h2
          id="my-sideline-heading"
          className="font-display mb-5 text-3xl font-black"
        >
          My SIDELINE
        </h2>
        <EmptyState
          title="Build your SIDELINE"
          description="Follow your favorite teams to see live games, moments, and conversations in one place."
          action={
            <Link href="/teams" className={buttonStyles()}>
              Choose teams
            </Link>
          }
        />
      </section>
    );
  }

  const hasRelevantActivity =
    liveGames.length ||
    upcomingGames.length ||
    recentGames.length ||
    flashThreads.length;

  return (
    <section
      aria-labelledby="my-sideline-heading"
      className="grid min-w-0 gap-10"
    >
      <div>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-brand text-xs font-bold tracking-[.16em] uppercase">
              Personalized for you
            </p>
            <h2
              id="my-sideline-heading"
              className="font-display text-3xl font-black"
            >
              My Teams
            </h2>
          </div>
          <Link href="/teams" className="text-brand font-bold hover:underline">
            Manage teams
          </Link>
        </div>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {teams.slice(0, 8).map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              following
              signedIn
              callbackUrl="/"
              compact
            />
          ))}
        </div>
      </div>

      <PersonalizedGames title="Live for You" games={liveGames} />
      <PersonalizedGames title="Coming Up" games={upcomingGames} />
      <PersonalizedGames title="Latest from Your Teams" games={recentGames} />

      {flashThreads.length ? (
        <div>
          <div className="mb-5 flex items-center gap-2">
            <Radio aria-hidden className="text-brand size-5" />
            <h3 className="font-display text-2xl font-black">
              Conversations from Your Teams
            </h3>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {flashThreads.map((thread) => (
              <Link
                key={thread.id}
                href={`/games/${thread.game.id}`}
                className="border-border-subtle bg-surface-2 hover:border-brand focus-visible:outline-brand rounded-md border p-5 transition focus-visible:outline-2"
              >
                <span className="text-brand text-xs font-bold tracking-wide uppercase">
                  Flash Thread · {thread.moment.type.replaceAll("_", " ")}
                </span>
                <h4 className="mt-2 text-lg font-black">{thread.title}</h4>
                <p className="text-text-secondary mt-2 text-sm">
                  {thread.game.awayTeam.name} at {thread.game.homeTeam.name}
                  {thread.moment.period ? ` · ${thread.moment.period}` : ""}
                  {thread.moment.clock ? ` ${thread.moment.clock}` : ""}
                </p>
                <p className="text-text-muted mt-3 text-sm">
                  {thread._count.takes} fan takes
                </p>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {!hasRelevantActivity ? (
        <EmptyState
          title="Your teams are quiet right now"
          description="There are no live or upcoming games in this window. Explore what the rest of SIDELINE is talking about."
          action={
            <Link
              href="/games"
              className={buttonStyles({ variant: "secondary" })}
            >
              Explore games
            </Link>
          }
        />
      ) : null}
    </section>
  );
}

function PersonalizedGames({
  title,
  games,
}: {
  title: string;
  games: MySidelineGame[];
}) {
  if (!games.length) return null;
  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        <Sparkles aria-hidden className="text-brand size-5" />
        <h3 className="font-display text-2xl font-black">{title}</h3>
      </div>
      <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
            statusText={gameStatusLabel(game)}
            scheduledAt={game.scheduledAt.toISOString()}
            broadcast={game.broadcast ?? undefined}
            conversationCount={game._count.takes}
            followerCount={game._count.follows}
          />
        ))}
      </div>
    </div>
  );
}
