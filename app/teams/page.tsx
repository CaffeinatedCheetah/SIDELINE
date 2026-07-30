import type { Metadata } from "next";

import { auth } from "@/auth";
import { TeamDiscoveryGrid } from "@/components/teams/team-discovery-grid";
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

  return (
    <div className="page-container min-w-0 py-10 md:py-14">
      <header className="border-border-subtle bg-surface-2 relative overflow-hidden rounded-2xl border p-6 shadow-lg md:p-8">
        <div
          aria-hidden
          className="bg-brand/15 absolute -top-24 right-0 size-60 rounded-full blur-3xl"
        />
        <div className="relative max-w-3xl">
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
        </div>
      </header>

      {!teams.length ? (
        <div className="mt-10">
          <EmptyState
            title="No teams are available yet"
            description="League and team data will appear here after the next verified sports synchronization."
          />
        </div>
      ) : (
        <TeamDiscoveryGrid
          teams={teams}
          followedTeamIds={Array.from(followedTeamIds)}
          signedIn={Boolean(session?.user?.id)}
        />
      )}
    </div>
  );
}
