import type { Metadata } from "next";
import { GameCard } from "@/components/games/game-card";
import { PageHeading } from "@/components/layout/page-heading";
import { EmptyState } from "@/components/ui/foundations";
import { Select } from "@/components/ui/form-controls";
import { SUPPORTED_LEAGUES } from "@/lib/sports/leagues";
import {
  gameStatusLabel,
  getSportsGameDirectory,
  type SportsGame,
} from "@/lib/sports/read-model";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Games",
  description: "Live, upcoming, and final sports games.",
};

export default async function GamesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; league?: string; date?: string }>;
}) {
  const filters = await searchParams;
  let games: SportsGame[] = [];
  let providerError = false;
  let stale = false;
  try {
    const directory = await getSportsGameDirectory({
      status: filters.status,
      leagueKey: filters.league,
      date: filters.date,
    });
    games = directory.games;
    providerError = directory.providerError;
    stale = directory.stale;
  } catch {}
  return (
    <div className="page-container py-10">
      <PageHeading
        eyebrow="The scoreboard is the front door"
        title="Games"
        description="Find what is live, what starts next, and where fans are talking."
      />
      <form className="border-border-subtle bg-surface-1 mb-8 grid gap-3 rounded-md border p-4 sm:grid-cols-4">
        <label className="grid gap-2 text-sm font-bold">
          Status
          <Select name="status" defaultValue={filters.status ?? ""}>
            <option value="">All games</option>
            <option value="LIVE">Live</option>
            <option value="SCHEDULED">Upcoming</option>
            <option value="FINAL">Final</option>
          </Select>
        </label>
        <label className="grid gap-2 text-sm font-bold">
          Sports date
          <input
            className="border-border-strong bg-surface-2 min-h-11 rounded-sm border px-3"
            type="date"
            name="date"
            defaultValue={filters.date ?? ""}
          />
        </label>
        <label className="grid gap-2 text-sm font-bold">
          League
          <Select name="league" defaultValue={filters.league ?? ""}>
            <option value="">All leagues</option>
            {SUPPORTED_LEAGUES.map((league) => (
              <option key={league.key} value={league.key}>
                {league.abbreviation}
              </option>
            ))}
          </Select>
        </label>
        <button className="bg-brand min-h-11 self-end rounded-sm px-4 font-bold">
          Apply filters
        </button>
      </form>
      {(providerError || stale) && games.length > 0 ? (
        <p role="status" className="text-text-secondary mb-5 text-sm">
          {stale
            ? "Showing the most recent synchronized schedule while live data refreshes."
            : "Some leagues could not refresh; available games are still shown."}
        </p>
      ) : null}
      {games.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {games.map((game) => (
            <GameCard
              key={game.id}
              id={game.id}
              league={game.league.abbreviation}
              homeTeam={game.homeTeam.name}
              awayTeam={game.awayTeam.name}
              homeLogoUrl={game.homeTeam.logoUrl}
              awayLogoUrl={game.awayTeam.logoUrl}
              homeScore={game.homeScore ?? undefined}
              awayScore={game.awayScore ?? undefined}
              status={game.status}
              statusText={gameStatusLabel(game)}
              scheduledAt={game.scheduledAt.toISOString()}
              broadcast={game.broadcast}
              conversationCount={game._count.takes}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title={
            providerError ? "Schedules could not refresh" : "No games match"
          }
          description={
            providerError
              ? "No synchronized schedule is available yet. Try again shortly."
              : "Try another status or league."
          }
        />
      )}
    </div>
  );
}
