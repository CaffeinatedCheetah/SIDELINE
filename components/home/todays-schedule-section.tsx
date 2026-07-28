import Link from "next/link";
import { GameCard } from "@/components/games/game-card";
import { LiveAutoRefresh } from "@/components/games/live-auto-refresh";
import { EmptyState } from "@/components/ui/foundations";
import {
  gameStatusLabel,
  getSportsGameDirectory,
} from "@/lib/sports/read-model";

export async function TodaysScheduleSection() {
  const directory = await getSportsGameDirectory({ limit: 6 });
  const games = directory.games;
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
                league={game.league.abbreviation}
                homeTeam={game.homeTeam.name}
                awayTeam={game.awayTeam.name}
                homeTeamLogo={game.homeTeam.logoUrl ?? undefined}
                awayTeamLogo={game.awayTeam.logoUrl ?? undefined}
                homeScore={game.homeScore ?? undefined}
                awayScore={game.awayScore ?? undefined}
                status={game.status}
                scheduledAt={game.scheduledAt.toISOString()}
                broadcast={game.broadcast ?? undefined}
                statusText={gameStatusLabel(game)}
                conversationCount={game._count.takes}
              />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title={
            directory.providerError
              ? "Schedules could not refresh"
              : "No games scheduled today"
          }
          description={
            directory.providerError
              ? "No synchronized schedule is available yet. Try again shortly."
              : "Check back tomorrow, or browse the full schedule."
          }
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
