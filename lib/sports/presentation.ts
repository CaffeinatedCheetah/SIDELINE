import type { CSSProperties } from "react";

import type { SupportedLeague } from "@/lib/sports/leagues";

const LEAGUE_COLORS: Record<string, [string, string]> = {
  nfl: ["#2563eb", "#60a5fa"],
  nba: ["#ea580c", "#fb923c"],
  mlb: ["#dc2626", "#3b82f6"],
  nhl: ["#0891b2", "#67e8f9"],
  wnba: ["#f97316", "#22c55e"],
  epl: ["#7c3aed", "#22d3ee"],
  mls: ["#dc2626", "#2563eb"],
  "la-liga": ["#ef4444", "#facc15"],
  bundesliga: ["#dc2626", "#f8fafc"],
  "serie-a": ["#2563eb", "#22d3ee"],
  "ligue-1": ["#1d4ed8", "#facc15"],
  "champions-league": ["#4f46e5", "#a78bfa"],
  "world-cup": ["#9f1239", "#fbbf24"],
};

export function leagueColors(key: string) {
  const [primary, secondary] = LEAGUE_COLORS[key] ?? ["#7c3aed", "#a78bfa"];
  return { primary, secondary };
}

export function leagueTheme(key: string): CSSProperties {
  const { primary, secondary } = leagueColors(key);
  return {
    "--league-primary": primary,
    "--league-secondary": secondary,
    "--league-soft": `color-mix(in srgb, ${primary} 14%, var(--surface-2))`,
    "--league-glow": `color-mix(in srgb, ${secondary} 18%, transparent)`,
  } as CSSProperties;
}

export function shortLeagueLabel(
  league: Pick<SupportedLeague, "key" | "abbreviation">,
) {
  if (league.key === "champions-league") return "UCL";
  if (league.key === "world-cup") return "World Cup";
  return league.abbreviation;
}

export function sportPhaseLabel({
  sportKey,
  period,
  clock,
  detail,
}: {
  sportKey?: string;
  period?: string | null;
  clock?: string | null;
  detail?: string | null;
}) {
  if (detail && !period && !clock) return detail;
  if (sportKey === "soccer")
    return [clock ? (clock.includes("'") ? clock : `${clock}'`) : null, period]
      .filter(Boolean)
      .join(" · ");
  return [period, clock].filter(Boolean).join(" · ");
}
