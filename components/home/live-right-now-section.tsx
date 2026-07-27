import Link from "next/link";
import { GameCard } from "@/components/games/game-card";
import { LiveAutoRefresh } from "@/components/games/live-auto-refresh";
import { EmptyState } from "@/components/ui/foundations";
import { fetchScoreboardsForTab } from "@/lib/sports/espn";

export async function LiveRightNowSection() {
  const games = (await fetchScoreboardsForTab("ALL")).filter(
    (game) => game.status === "LIVE",
  );
  const visible = games.slice(0, 8);

  return (
    <section>
      {visible.length > 0 && <LiveAutoRefresh active />}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <h2 className="font-display min-w-0 text-3xl font-black">
          Live right now
        </h2>
        <Link
          href="/games?tab=ALL"
          className="text-brand shrink-0 font-bold hover:underline"
        >
          View all
        </Link>
      </div>
      {visible.length ? (
        <div className="-mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-2">
          {visible.map((game) => (
            <div key={game.id} className="w-72 shrink-0 snap-start">
              <GameCard
                id={game.id}
                league={game.leagueLabel}
                homeTeam={game.homeTeam.name}
                awayTeam={game.awayTeam.name}
                homeTeamLogo={game.homeTeam.logo}
                awayTeamLogo={game.awayTeam.logo}
                homeScore={game.homeScore}
                awayScore={game.awayScore}
                status={game.status}
                scheduledAt={game.scheduledAt}
                broadcast={game.broadcast}
                statusText={game.statusDetail || "Live"}
              />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No live game right now"
          description="See what starts next."
          action={
            <Link href="/games" className="text-brand font-bold hover:underline">
              View games
            </Link>
          }
        />
      )}
    </section>
  );
}
