import Link from "next/link";
import { auth } from "@/auth";
import { GameCard } from "@/components/games/game-card";
import { EmptyState } from "@/components/ui/foundations";
import { getTodaysSchedule } from "@/lib/db/todays-schedule";

export async function TodaysScheduleSection() {
  const session = await auth();
  const { games, failed } = await getTodaysSchedule(session?.user?.id);

  return (
    <section>
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
      {failed ? (
        <EmptyState
          title="Schedule is unavailable"
          description="We couldn't load today's games right now. Try Games for the latest."
          action={
            <Link
              href="/games"
              className="text-brand font-bold hover:underline"
            >
              Go to Games
            </Link>
          }
        />
      ) : games.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {games.map((game) => (
            <GameCard
              key={game.id}
              id={game.id}
              league={game.league.abbreviation}
              homeTeam={game.homeTeam.name}
              awayTeam={game.awayTeam.name}
              homeTeamLogo={game.homeTeam.logoUrl ?? undefined}
              awayTeamLogo={game.awayTeam.logoUrl ?? undefined}
              homeScore={game.homeScore ?? undefined}
              awayScore={game.awayScore ?? undefined}
              status={game.status}
              statusText={
                game.status === "LIVE"
                  ? `${game.period ?? "Live"} ${game.clock ?? ""}`.trim()
                  : game.status
              }
              conversationCount={game._count.takes}
            />
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
