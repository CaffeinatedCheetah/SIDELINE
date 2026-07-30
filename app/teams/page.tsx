import type { Metadata } from "next";

import { auth } from "@/auth";
import { TeamCard } from "@/components/teams/team-card";
import { EmptyState } from "@/components/ui/foundations";
import { getTeamDiscovery } from "@/lib/db/my-sideline";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Choose your teams",
  description:
    "Follow the teams you care about and build your personalized SIDELINE.",
};

export default async function TeamsPage() {
  const session = await auth();
  const { teams, followedTeamIds } = await getTeamDiscovery(session?.user?.id);
  const leagues = teams.reduce(
    (groups, team) => {
      const league = team.league.abbreviation;
      (groups[league] ??= []).push(team);
      return groups;
    },
    {} as Record<string, typeof teams>,
  );

  return (
    <div className="page-container min-w-0 py-10 md:py-14">
      <header className="max-w-3xl">
        <p className="text-brand text-sm font-bold tracking-[.18em] uppercase">
          My SIDELINE
        </p>
        <h1 className="font-display mt-3 text-5xl font-black tracking-tight md:text-6xl">
          Choose your teams
        </h1>
        <p className="text-text-secondary mt-4 text-lg">
          Follow teams to bring their live games, verified moments, and fan
          conversations to your homepage.
        </p>
      </header>

      {!teams.length ? (
        <div className="mt-10">
          <EmptyState
            title="No teams are available yet"
            description="League and team data will appear here after the next verified sports synchronization."
          />
        </div>
      ) : (
        <div className="mt-12 grid min-w-0 gap-12">
          {Object.entries(leagues).map(([league, leagueTeams]) => (
            <section key={league} aria-labelledby={`league-${league}`}>
              <h2
                id={`league-${league}`}
                className="font-display mb-5 text-3xl font-black"
              >
                {league}
              </h2>
              <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {leagueTeams.map((team) => (
                  <TeamCard
                    key={team.id}
                    team={team}
                    following={followedTeamIds.has(team.id)}
                    signedIn={Boolean(session?.user?.id)}
                    callbackUrl="/teams"
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
