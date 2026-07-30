import Link from "next/link";

import { LeagueCard } from "@/components/leagues/league-card";

export function ExploreLeaguesSection({
  leagues,
}: {
  leagues: Array<{
    key: string;
    name: string;
    abbreviation: string;
    sportKey: string;
    sportName: string;
    teamCount: number;
    liveGameCount: number;
    followedTeamCount: number;
  }>;
}) {
  return (
    <section aria-labelledby="explore-leagues-title">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-brand text-xs font-bold tracking-[0.16em] uppercase">
            Every sport, one SIDELINE
          </p>
          <h2
            id="explore-leagues-title"
            className="font-display text-3xl font-black"
          >
            Explore leagues
          </h2>
        </div>
        <Link href="/leagues" className="text-brand font-bold hover:underline">
          View all leagues
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {leagues.slice(0, 6).map((league) => (
          <LeagueCard key={league.key} league={league} />
        ))}
      </div>
    </section>
  );
}
