import Link from "next/link";
import { Sparkles, TrendingUp, MessageSquareText, CirclePlay } from "lucide-react";

import { GameCard } from "@/components/games/game-card";
import { buttonStyles } from "@/components/ui/button";
import { Badge, Card, EmptyState } from "@/components/ui/foundations";
import { getScoutHighlights } from "@/lib/db/scout-highlights";

function truncate(value: string, max = 140) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

export async function ScoutSection() {
  const highlights = await getScoutHighlights();

  return (
    <section aria-labelledby="scout-heading">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-brand text-xs font-bold tracking-[0.16em] uppercase">
            SCOUT
          </p>
          <h2
            id="scout-heading"
            className="font-display text-3xl font-black"
          >
            Top Story, trending topics, and a suggested debate
          </h2>
        </div>
        <Link href="/discover" className="text-brand font-bold hover:underline">
          Explore discovery
        </Link>
      </div>

      {highlights.failed ? (
        <EmptyState
          title="SCOUT is unavailable"
          description="The stored Scout highlights could not be loaded right now."
          action={
            <Link href="/discover" className={buttonStyles({ variant: "secondary" })}>
              Explore live content
            </Link>
          }
        />
      ) : !highlights.topStory &&
        !highlights.trendingTopics.length &&
        !highlights.suggestedDebate &&
        !highlights.trendingMatchup ? (
        <EmptyState
          title="SCOUT has no highlights yet"
          description="Once the platform generates Scout content, it will appear here without regeneration."
          action={
            <Link href="/discover" className={buttonStyles({ variant: "secondary" })}>
              Discover activity
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
          <Card className="overflow-hidden p-0">
            <div className="border-brand/20 bg-brand/8 border-b px-5 py-4">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles aria-hidden className="text-brand size-4" />
                <Badge tone="neutral">Top Story</Badge>
              </div>
              <h3 className="font-display text-2xl font-black">
                {highlights.topStory
                  ? truncate(highlights.topStory.body, 150)
                  : "No top story yet"}
              </h3>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-2">
              <div className="bg-surface-2 rounded-2xl p-4">
                <div className="mb-2 flex items-center gap-2">
                  <TrendingUp aria-hidden className="text-brand size-4" />
                  <p className="text-xs font-bold tracking-wide uppercase">
                    Trending topics
                  </p>
                </div>
                <div className="grid gap-3">
                  {highlights.trendingTopics.length ? (
                    highlights.trendingTopics.map((topic, index) => (
                      <article
                        key={topic.id}
                        className="border-border-subtle bg-surface rounded-xl border p-3"
                      >
                        <p className="text-text-muted text-[11px] font-bold uppercase">
                          Topic {index + 1}
                        </p>
                        <p className="mt-1 text-sm leading-6">
                          {truncate(topic.body, 110)}
                        </p>
                        <p className="text-text-muted mt-2 text-xs">
                          {topic.reactions} reactions · {topic.replies} replies
                        </p>
                      </article>
                    ))
                  ) : (
                    <p className="text-text-secondary text-sm">
                      No Scout topics yet.
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-surface-2 rounded-2xl p-4">
                <div className="mb-2 flex items-center gap-2">
                  <MessageSquareText aria-hidden className="text-brand size-4" />
                  <p className="text-xs font-bold tracking-wide uppercase">
                    Suggested debate
                  </p>
                </div>
                {highlights.suggestedDebate ? (
                  <Link
                    href={`/debates/${highlights.suggestedDebate.slug}`}
                    className="group block rounded-xl border border-transparent p-3 transition hover:border-border-strong hover:bg-surface"
                  >
                    <p className="text-brand text-xs font-bold tracking-wide uppercase">
                      {highlights.suggestedDebate.options
                        .map((option) => option.label)
                        .slice(0, 2)
                        .join(" vs ")}
                    </p>
                    <h3 className="mt-2 text-lg font-black group-hover:underline">
                      {highlights.suggestedDebate.title}
                    </h3>
                    <p className="text-text-secondary mt-2 text-sm leading-6">
                      {truncate(highlights.suggestedDebate.prompt, 120)}
                    </p>
                    <p className="text-text-muted mt-2 text-xs">
                      {highlights.suggestedDebate.replies} replies
                    </p>
                  </Link>
                ) : (
                  <p className="text-text-secondary text-sm">
                    No Scout debate is available yet.
                  </p>
                )}
              </div>
            </div>
          </Card>

          <div className="grid gap-4">
            <Card className="bg-surface-2/80 p-4">
              <div className="mb-3 flex items-center gap-2">
                <CirclePlay aria-hidden className="text-brand size-4" />
                <p className="text-xs font-bold tracking-wide uppercase">
                  Trending matchup
                </p>
              </div>
              {highlights.trendingMatchup ? (
                <GameCard
                  id={highlights.trendingMatchup.id}
                  league={highlights.trendingMatchup.league.abbreviation}
                  leagueKey={highlights.trendingMatchup.league.key}
                  homeTeam={highlights.trendingMatchup.homeTeam.name}
                  awayTeam={highlights.trendingMatchup.awayTeam.name}
                  homeTeamLogo={highlights.trendingMatchup.homeTeam.logoUrl ?? undefined}
                  awayTeamLogo={highlights.trendingMatchup.awayTeam.logoUrl ?? undefined}
                  homeScore={highlights.trendingMatchup.homeScore}
                  awayScore={highlights.trendingMatchup.awayScore}
                  status={highlights.trendingMatchup.status}
                  statusText={highlights.trendingMatchup.statusText}
                  scheduledAt={highlights.trendingMatchup.scheduledAt.toISOString()}
                  broadcast={highlights.trendingMatchup.broadcast ?? undefined}
                  conversationCount={highlights.trendingMatchup.conversations}
                  followerCount={highlights.trendingMatchup.followers}
                />
              ) : (
                <p className="text-text-secondary text-sm">
                  No matchup data is available yet.
                </p>
              )}
            </Card>
          </div>
        </div>
      )}
    </section>
  );
}
