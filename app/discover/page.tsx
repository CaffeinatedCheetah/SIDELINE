import type { Metadata } from "next";
import {
  Flame,
  MessageCircle,
  Radio,
  Search,
  Trophy,
  Users,
} from "lucide-react";
import Link from "next/link";

import { DebateCard } from "@/components/debates/debate-card";
import { GameCard } from "@/components/games/game-card";
import { LeagueMark } from "@/components/leagues/league-mark";
import { PageHeading } from "@/components/layout/page-heading";
import { Badge, EmptyState } from "@/components/ui/foundations";
import { LocalDateTime } from "@/components/ui/local-date-time";
import { getDiscoverFeed } from "@/lib/db/discover";
import { getSupportedLeague } from "@/lib/sports/leagues";
import { formatCount } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Discover",
  description: "Find the games and fan conversations moving right now.",
};

export default async function DiscoverPage() {
  const feed = await getDiscoverFeed();
  const hasActivity =
    feed.trendingGames.length ||
    feed.debates.length ||
    feed.flashThreads.length ||
    feed.recentMoments.length;

  return (
    <div className="page-container py-8 sm:py-10">
      <PageHeading
        eyebrow="Live fan activity"
        title="Discover"
        description="Find the games, verified moments, and fan conversations moving right now."
        action={
          <Link
            href="/search"
            className="border-border-strong bg-surface-2 hover:bg-surface-3 focus-visible:ring-focus inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-bold transition focus-visible:ring-2 focus-visible:outline-none"
          >
            <Search aria-hidden className="size-4" />
            Search SIDELINE
          </Link>
        }
      />

      {!hasActivity ? (
        <EmptyState
          title="Nothing live right now"
          description="Upcoming games and new fan conversations will appear here as activity starts."
        />
      ) : (
        <div className="grid gap-10">
          {feed.trendingGames.length ? (
            <DiscoverSection
              eyebrow="Fans are gathering"
              title="Trending games"
              href="/games"
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {feed.trendingGames.map((game) => (
                  <GameCard
                    key={game.id}
                    id={game.id}
                    league={game.league.abbreviation}
                    leagueKey={game.league.key}
                    homeTeam={game.homeTeam.name}
                    awayTeam={game.awayTeam.name}
                    homeScore={game.homeScore ?? undefined}
                    awayScore={game.awayScore ?? undefined}
                    status={game.status}
                    statusText={
                      [game.period, game.clock].filter(Boolean).join(" · ") ||
                      game.status
                    }
                    scheduledAt={game.scheduledAt.toISOString()}
                    conversationCount={game._count.takes}
                    followerCount={game._count.follows}
                  />
                ))}
              </div>
            </DiscoverSection>
          ) : null}

          {feed.flashThreads.length ? (
            <DiscoverSection
              eyebrow="Verified moments"
              title="Hot Flash Threads"
            >
              <div className="grid gap-4 lg:grid-cols-2">
                {feed.flashThreads.map((thread) => (
                  <Link
                    key={thread.id}
                    href={`/games/${thread.gameId}`}
                    className="border-brand/25 bg-brand-surface/35 hover:border-brand/60 focus-visible:ring-focus group relative overflow-hidden rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:outline-none motion-reduce:transform-none"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <Badge tone="live">Flash Thread</Badge>
                      <span className="text-text-muted flex items-center gap-1.5 text-xs font-bold">
                        <MessageCircle aria-hidden className="size-3.5" />
                        {formatCount(thread._count.takes)} takes
                      </span>
                    </div>
                    <h3 className="font-display mt-4 text-xl font-black">
                      {thread.title}
                    </h3>
                    <p className="text-text-secondary mt-2 text-sm">
                      {thread.game.league.abbreviation} ·{" "}
                      {thread.game.awayTeam.abbreviation} at{" "}
                      {thread.game.homeTeam.abbreviation}
                    </p>
                    <p className="text-text-muted mt-3 flex items-center gap-2 text-xs">
                      <Radio aria-hidden className="text-brand size-3.5" />
                      {[thread.moment.period, thread.moment.clock]
                        .filter(Boolean)
                        .join(" · ") || "Verified game moment"}
                    </p>
                  </Link>
                ))}
              </div>
            </DiscoverSection>
          ) : null}

          {feed.debates.length ? (
            <DiscoverSection
              eyebrow="Take a side"
              title="Trending debates"
              href="/debates"
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {feed.debates.map((debate) => (
                  <DebateCard
                    key={debate.id}
                    id={debate.slug}
                    title={debate.title}
                    category="Trending"
                    league={debate.game?.league.abbreviation}
                    options={debate.options.map((option) => ({
                      label: option.label,
                      votes: option._count.votes,
                    }))}
                    replyCount={debate._count.comments}
                  />
                ))}
              </div>
            </DiscoverSection>
          ) : null}

          <div className="grid gap-8 lg:grid-cols-2">
            {feed.teams.length ? (
              <DiscoverSection eyebrow="Real follows" title="Popular teams">
                <div className="grid gap-2 sm:grid-cols-2">
                  {feed.teams.map((team) => (
                    <Link
                      key={team.id}
                      href={`/games?league=${team.league.key}&team=${team.id}`}
                      className="border-border-subtle bg-surface-1 hover:border-border-strong flex items-center gap-3 rounded-xl border p-3 transition"
                    >
                      <span className="bg-surface-3 grid size-10 place-items-center overflow-hidden rounded-xl font-black">
                        {team.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={team.logoUrl}
                            alt=""
                            className="size-8 object-contain"
                          />
                        ) : (
                          team.abbreviation
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate">{team.name}</strong>
                        <span className="text-text-muted text-xs">
                          {team.league.abbreviation}
                        </span>
                      </span>
                      <span className="text-text-muted flex items-center gap-1 text-xs">
                        <Users aria-hidden className="size-3.5" />
                        {formatCount(team._count.followers)}
                      </span>
                    </Link>
                  ))}
                </div>
              </DiscoverSection>
            ) : null}

            {feed.leagues.length ? (
              <DiscoverSection
                eyebrow="Across SIDELINE"
                title="Popular leagues"
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  {feed.leagues.map((league) => {
                    const supported = getSupportedLeague(league.key);
                    return (
                      <Link
                        key={league.id}
                        href={`/leagues/${league.key}`}
                        className="border-border-subtle bg-surface-1 hover:border-border-strong flex items-center gap-3 rounded-xl border p-3 transition"
                      >
                        <LeagueMark
                          abbreviation={league.abbreviation}
                          sportKey={supported?.sportKey ?? league.sport.key}
                          className="size-11 rounded-xl [&_svg]:size-5"
                        />
                        <span>
                          <strong className="block">{league.name}</strong>
                          <span className="text-text-muted text-xs">
                            {league._count.teams} teams · {league._count.games}{" "}
                            games
                          </span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </DiscoverSection>
            ) : null}
          </div>

          {feed.recentMoments.length ? (
            <DiscoverSection eyebrow="As it happened" title="Recent activity">
              <ol className="border-border-subtle bg-surface-1 overflow-hidden rounded-2xl border">
                {feed.recentMoments.map((moment) => (
                  <li
                    key={moment.id}
                    className="border-border-subtle flex gap-4 border-b p-4 last:border-0"
                  >
                    <span className="bg-brand-surface text-brand grid size-10 shrink-0 place-items-center rounded-xl">
                      {moment.importance >= 70 ? (
                        <Flame aria-hidden className="size-5" />
                      ) : (
                        <Trophy aria-hidden className="size-5" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/games/${moment.gameId}`}
                        className="font-bold hover:underline"
                      >
                        {moment.title}
                      </Link>
                      <p className="text-text-secondary mt-1 text-sm">
                        {moment.game.league.abbreviation} ·{" "}
                        {moment.game.awayTeam.abbreviation} at{" "}
                        {moment.game.homeTeam.abbreviation}
                      </p>
                      <LocalDateTime
                        value={moment.occurredAt.toISOString()}
                        className="text-text-muted mt-1 block text-xs"
                      />
                    </div>
                  </li>
                ))}
              </ol>
            </DiscoverSection>
          ) : null}
        </div>
      )}
    </div>
  );
}

function DiscoverSection({
  eyebrow,
  title,
  href,
  children,
}: {
  eyebrow: string;
  title: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-brand text-xs font-bold tracking-[0.16em] uppercase">
            {eyebrow}
          </p>
          <h2 className="font-display mt-1 text-2xl font-black sm:text-3xl">
            {title}
          </h2>
        </div>
        {href ? (
          <Link
            href={href}
            className="text-brand text-sm font-bold hover:underline"
          >
            View all
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}
