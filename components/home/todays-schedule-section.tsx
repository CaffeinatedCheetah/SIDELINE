import Link from "next/link";
import { GameCard } from "@/components/games/game-card";
import { LiveAutoRefresh } from "@/components/games/live-auto-refresh";
import { EmptyState } from "@/components/ui/foundations";
import { fetchScoreboardsForTab, sortByLiveFirst } from "@/lib/sports/espn";

export async function TodaysScheduleSection() {
  const games = sortByLiveFirst(await fetchScoreboardsForTab("ALL")).slice(
    0,
    6,
  );
  const hasLive = games.some((game) => game.status === "LIVE");

  return (
    <section>
      <LiveAutoRefresh active={hasLive} />
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <h2 className="font-display min-w-0 text-3xl font-black">
          Today&apos;s schedule
        </h2>
        <Link
          href="/games"
          className="text-brand shrink-0 font-bold hover:underline"
        >
          View all games
        </Link>
      </div>
      {games.length ? (
        <div className="-mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-2">
          {games.map((game) => (
            <div key={game.id} className="w-72 shrink-0 snap-start">
              <GameCard
                id={game.id}
                league={game.leagueLabel}
                homeTeam={game.homeTeam.name}
                awayTeam={game.awayTeam.name}
                homeTeamLogo={game.homeTeam.logo}
                awayTeamLogo={game.awayTeam.logo}
                homeScore={game.homeScore ?? undefined}
                awayScore={game.awayScore ?? undefined}
                status={game.status}
                scheduledAt={game.scheduledAt}
                statusText={
                  game.status === "LIVE"
                    ? game.statusDetail || "Live"
                    : game.status === "FINAL"
                      ? "Final"
                      : game.statusDetail || game.status
                }
              />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No games scheduled today"
          description="Check back tomorrow, or browse the full schedule."
          action={
            <Link
              href="/games"
              className="text-brand font-bold hover:underline"
            >
              Go to Games
            </Link>
          }
        />
      )}
    </section>
  );
}
