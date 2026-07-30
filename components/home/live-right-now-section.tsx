import Link from "next/link";
import { GameCard } from "@/components/games/game-card";
import { LiveAutoRefresh } from "@/components/games/live-auto-refresh";
import { EmptyState } from "@/components/ui/foundations";
import {
  gameStatusLabel,
  getSportsGameDirectory,
} from "@/lib/sports/read-model";

export async function LiveRightNowSection() {
  const directory = await getSportsGameDirectory({
    status: "LIVE",
    limit: 8,
  });
  const visible = directory.games;

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
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title={
            directory.providerError
              ? "Schedules could not refresh"
              : "No live game right now"
          }
          description={
            directory.providerError
              ? "No synchronized live schedule is available yet."
              : "See what starts next."
          }
          action={
            <Link
              href="/games"
              className="text-brand font-bold hover:underline"
            >
              View games
            </Link>
          }
        />
      )}
    </section>
  );
}
