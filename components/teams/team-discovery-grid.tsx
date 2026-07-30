"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { useMemo, useState } from "react";

import { TeamCard } from "@/components/teams/team-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/foundations";
import { cn } from "@/lib/utils";

type DiscoveryTeam = {
  id: string;
  name: string;
  abbreviation: string;
  city: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  league: { key: string; name: string; abbreviation: string };
};

export function TeamDiscoveryGrid({
  teams,
  followedTeamIds,
  signedIn,
}: {
  teams: DiscoveryTeam[];
  followedTeamIds: string[];
  signedIn: boolean;
}) {
  const [query, setQuery] = useState("");
  const [league, setLeague] = useState("ALL");
  const [myTeams, setMyTeams] = useState(false);
  const followed = useMemo(() => new Set(followedTeamIds), [followedTeamIds]);
  const leagues = useMemo(
    () =>
      Array.from(
        new Map(
          teams.map((team) => [
            team.league.key,
            {
              key: team.league.key,
              abbreviation: team.league.abbreviation,
              name: team.league.name,
            },
          ]),
        ).values(),
      ),
    [teams],
  );
  const normalized = query.trim().toLowerCase();
  const visible = teams.filter((team) => {
    if (league !== "ALL" && team.league.key !== league) return false;
    if (myTeams && !followed.has(team.id)) return false;
    if (!normalized) return true;
    return [team.name, team.city, team.abbreviation].some((value) =>
      value?.toLowerCase().includes(normalized),
    );
  });
  const grouped = visible.reduce(
    (result, team) => {
      (result[team.league.abbreviation] ??= []).push(team);
      return result;
    },
    {} as Record<string, DiscoveryTeam[]>,
  );
  const filtered = normalized || league !== "ALL" || myTeams;

  return (
    <div className="mt-8 min-w-0">
      <div className="border-border-subtle bg-surface-1/90 sticky top-16 z-20 rounded-2xl border p-3 shadow-lg backdrop-blur md:p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search teams</span>
            <Search
              aria-hidden
              className="text-text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search city, team, or abbreviation"
              className="border-border-strong bg-surface-2 min-h-11 w-full rounded-xl border pr-3 pl-10"
            />
          </label>
          {signedIn ? (
            <Button
              type="button"
              variant={myTeams ? "primary" : "secondary"}
              aria-pressed={myTeams}
              onClick={() => setMyTeams((current) => !current)}
              className="shrink-0"
            >
              <SlidersHorizontal aria-hidden className="size-4" />
              My Teams
            </Button>
          ) : null}
          {filtered ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setQuery("");
                setLeague("ALL");
                setMyTeams(false);
              }}
            >
              <X aria-hidden className="size-4" />
              Clear filters
            </Button>
          ) : null}
        </div>
        <div
          className="mt-3 flex flex-wrap gap-2"
          role="group"
          aria-label="Filter by league"
        >
          <FilterChip
            label="All leagues"
            selected={league === "ALL"}
            onClick={() => setLeague("ALL")}
          />
          {leagues.map((item) => (
            <FilterChip
              key={item.key}
              label={`${item.abbreviation} · ${item.name}`}
              selected={league === item.key}
              onClick={() => setLeague(item.key)}
            />
          ))}
        </div>
      </div>

      {visible.length ? (
        <div className="mt-10 grid min-w-0 gap-12" aria-live="polite">
          {Object.entries(grouped).map(([label, leagueTeams]) => (
            <section key={label} aria-labelledby={`teams-${label}`}>
              <div className="mb-5 flex items-center gap-3">
                <h2
                  id={`teams-${label}`}
                  className="font-display text-2xl font-black"
                >
                  {label}
                </h2>
                <span className="bg-surface-3 text-text-muted rounded-full px-2.5 py-1 text-xs font-bold">
                  {leagueTeams.length}
                </span>
              </div>
              <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {leagueTeams.map((team) => (
                  <TeamCard
                    key={team.id}
                    team={team}
                    following={followed.has(team.id)}
                    signedIn={signedIn}
                    callbackUrl="/teams"
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="mt-10">
          <EmptyState
            title={myTeams ? "No favorites here yet" : "No teams found"}
            description={
              myTeams
                ? "Follow a team to add this league to My SIDELINE."
                : "Try a city, team name, or abbreviation."
            }
          />
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "min-h-9 rounded-full border px-3 py-1.5 text-xs font-bold transition",
        selected
          ? "border-brand bg-brand-surface text-brand-light"
          : "border-border-subtle bg-surface-2 text-text-secondary hover:border-border-strong hover:bg-surface-3",
      )}
    >
      {selected ? "✓ " : ""}
      {label}
    </button>
  );
}
