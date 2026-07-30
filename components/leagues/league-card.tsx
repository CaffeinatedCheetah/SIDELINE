import { ArrowUpRight, Radio, Users } from "lucide-react";
import Link from "next/link";

import { LeagueMark } from "@/components/leagues/league-mark";
import { leagueTheme, shortLeagueLabel } from "@/lib/sports/presentation";

export function LeagueCard({
  league,
}: {
  league: {
    key: string;
    name: string;
    abbreviation: string;
    sportKey: string;
    sportName: string;
    teamCount: number;
    liveGameCount: number;
    followedTeamCount: number;
  };
}) {
  const label = shortLeagueLabel(league);
  return (
    <Link
      href={`/leagues/${league.key}`}
      style={leagueTheme(league.key)}
      className="group border-border-subtle focus-visible:outline-brand relative min-w-0 overflow-hidden rounded-2xl border bg-[linear-gradient(145deg,var(--league-soft),var(--surface-2)_62%)] p-5 shadow-[0_12px_30px_rgb(0_0_0/0.12)] transition hover:border-[color:var(--league-primary)] hover:shadow-xl focus-visible:outline-2 motion-safe:hover:-translate-y-0.5"
      data-league-card={league.key}
    >
      <div
        aria-hidden
        className="absolute -top-20 -right-14 size-44 rounded-full bg-[var(--league-glow)] blur-3xl"
      />
      <div className="relative flex items-start justify-between gap-4">
        <LeagueMark
          abbreviation={label}
          sportKey={league.sportKey}
          className="size-16"
        />
        <ArrowUpRight
          aria-hidden
          className="text-text-muted size-5 transition group-hover:text-[color:var(--league-secondary)]"
        />
      </div>
      <div className="relative mt-6">
        <p className="text-xs font-bold tracking-[0.16em] text-[color:var(--league-secondary)] uppercase">
          {league.sportName}
        </p>
        <h2 className="font-display mt-1 text-2xl leading-tight font-black">
          {league.name}
        </h2>
      </div>
      <dl className="border-border-subtle relative mt-5 grid grid-cols-2 gap-3 border-t pt-4 text-sm">
        <div>
          <dt className="text-text-muted">Teams</dt>
          <dd className="mt-0.5 flex items-center gap-1.5 font-black">
            <Users aria-hidden className="size-3.5" />
            {league.teamCount}
          </dd>
        </div>
        <div>
          <dt className="text-text-muted">Live now</dt>
          <dd className="mt-0.5 flex items-center gap-1.5 font-black">
            <Radio
              aria-hidden
              className={
                league.liveGameCount
                  ? "text-success motion-safe:animate-pulse"
                  : "text-text-muted"
              }
            />
            {league.liveGameCount}
          </dd>
        </div>
      </dl>
      {league.followedTeamCount ? (
        <p className="bg-surface-1/60 relative mt-4 rounded-full border border-[color:var(--league-primary)]/40 px-3 py-1.5 text-xs font-bold">
          {league.followedTeamCount} followed{" "}
          {league.followedTeamCount === 1 ? "team" : "teams"}
        </p>
      ) : null}
    </Link>
  );
}
