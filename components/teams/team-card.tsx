import Link from "next/link";

import { TeamFollowButton } from "@/components/teams/team-follow-button";
import { Card } from "@/components/ui/foundations";

function safeTeamColor(value: string | null | undefined) {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : "#ff5a36";
}

export function TeamCard({
  team,
  following,
  signedIn,
  callbackUrl,
  compact = false,
}: {
  team: {
    id: string;
    name: string;
    abbreviation: string;
    logoUrl: string | null;
    primaryColor: string | null;
    league: { key: string; abbreviation: string };
  };
  following: boolean;
  signedIn: boolean;
  callbackUrl: string;
  compact?: boolean;
}) {
  const gamesHref = `/games?tab=${encodeURIComponent(team.league.abbreviation)}`;
  return (
    <Card
      data-team-card={team.id}
      className="relative min-w-0 overflow-hidden"
      style={{ borderTopColor: safeTeamColor(team.primaryColor) }}
    >
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: safeTeamColor(team.primaryColor) }}
      />
      <div
        className={
          compact
            ? "grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3"
            : "grid min-w-0 gap-4"
        }
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="bg-surface-3 grid size-12 shrink-0 place-items-center overflow-hidden rounded-full font-black">
            {team.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={team.logoUrl}
                alt={`${team.name} logo`}
                className="size-10 object-contain"
              />
            ) : (
              team.abbreviation
            )}
          </span>
          <div className="min-w-0">
            <Link
              href={gamesHref}
              className="focus-visible:outline-brand block rounded-sm font-bold hover:underline focus-visible:outline-2"
            >
              <span className="block truncate">{team.name}</span>
            </Link>
            <span className="text-text-muted text-xs font-bold tracking-wide uppercase">
              {team.league.abbreviation} · {team.abbreviation}
            </span>
          </div>
        </div>
        <div className={compact ? "col-span-2" : ""}>
          <TeamFollowButton
            teamId={team.id}
            initialFollowing={following}
            signedIn={signedIn}
            callbackUrl={callbackUrl}
          />
        </div>
      </div>
    </Card>
  );
}
