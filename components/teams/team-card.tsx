import Link from "next/link";

import { TeamFollowButton } from "@/components/teams/team-follow-button";
import { Card } from "@/components/ui/foundations";

const TEAM_FALLBACKS = [
  "#2563eb",
  "#7c3aed",
  "#0891b2",
  "#c2410c",
  "#be123c",
  "#047857",
  "#a21caf",
  "#4338ca",
];

function safeTeamColor(value: string | null | undefined, fallbackKey: string) {
  if (value) {
    const normalized = value.startsWith("#") ? value : `#${value}`;
    if (/^#[0-9a-f]{6}$/i.test(normalized)) return normalized;
  }
  const hash = [...fallbackKey].reduce(
    (total, character) => (total * 31 + character.charCodeAt(0)) >>> 0,
    0,
  );
  return TEAM_FALLBACKS[hash % TEAM_FALLBACKS.length];
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
    city?: string | null;
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
      style={{
        borderTopColor: safeTeamColor(
          team.primaryColor,
          team.abbreviation || team.name,
        ),
      }}
    >
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-1"
        style={{
          backgroundColor: safeTeamColor(
            team.primaryColor,
            team.abbreviation || team.name,
          ),
        }}
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
              {team.city ? (
                <span className="text-text-muted block truncate text-xs font-semibold">
                  {team.city}
                </span>
              ) : null}
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
