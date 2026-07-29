import { Clock, Flame } from "lucide-react";
import Link from "next/link";
import { GameTime } from "@/components/games/game-time";
import { parseEspnGameId } from "@/lib/sports/espn";
import { Badge, Card } from "@/components/ui/foundations";

export interface GameCardProps {
  /** A real Prisma Game id (links straight to /games/[id]), an ESPN card
   * id in the `espn-<leagueKey>-<eventId>` form this app's ESPN fetchers
   * produce (links through the /games/from-espn resolver, which
   * materializes a real row on click), or omitted entirely for a card with
   * nothing real to link to (e.g. a fighter-sport event, which the
   * resolver doesn't support). */
  id?: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  homeScore?: number | null;
  awayScore?: number | null;
  status:
    | "SCHEDULED"
    | "PREGAME"
    | "LIVE"
    | "HALFTIME"
    | "FINAL"
    | "POSTPONED"
    | "CANCELLED";
  statusText: string;
  /** Required to show a start time when the game hasn't been played yet. */
  scheduledAt?: string;
  conversationCount?: number;
  /** e.g. "FOX", "ESPN+" -- shown when the source supplies it. */
  broadcast?: string;
  featured?: boolean;
}
export function GameCard(p: GameCardProps) {
  const hasScore =
    typeof p.homeScore === "number" && typeof p.awayScore === "number";
  const isEspnId = p.id?.startsWith("espn-") ?? false;
  const espnRef = isEspnId && p.id ? parseEspnGameId(p.id) : null;
  const href = espnRef
    ? `/games/from-espn/${espnRef.leagueKey}/${espnRef.eventId}`
    : !isEspnId && p.id
      ? `/games/${p.id}`
      : undefined;
  const card = (
    <Card
      className={`group hover:border-border-strong hover:bg-surface-3 relative min-w-0 overflow-hidden transition ${p.featured ? "p-6" : ""}`}
    >
      <div className="mb-4 flex min-w-0 items-center justify-between gap-2">
        <span className="text-text-muted min-w-0 truncate text-xs font-bold tracking-wider uppercase">
          {p.league}
        </span>
        <Badge
          tone={
            p.status === "LIVE" || p.status === "HALFTIME" ? "live" : "neutral"
          }
        >
          {p.statusText}
        </Badge>
      </div>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="grid min-w-0 gap-3">
          <div className="flex min-w-0 items-center gap-2 font-bold">
            {p.awayTeamLogo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.awayTeamLogo}
                alt=""
                aria-hidden
                className="size-6 shrink-0 object-contain"
              />
            )}
            <span className="truncate">{p.awayTeam}</span>
          </div>
          <div className="flex min-w-0 items-center gap-2 font-bold">
            {p.homeTeamLogo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.homeTeamLogo}
                alt=""
                aria-hidden
                className="size-6 shrink-0 object-contain"
              />
            )}
            <span className="truncate">{p.homeTeam}</span>
          </div>
        </div>
        <div className="grid shrink-0 justify-items-end gap-1 text-right">
          {hasScore ? (
            <div className="font-display grid gap-1 text-3xl font-black tabular-nums">
              <span>{p.awayScore}</span>
              <span>{p.homeScore}</span>
            </div>
          ) : p.scheduledAt ? (
            <div className="flex items-center gap-1.5">
              <Clock aria-hidden className="text-text-secondary size-4" />
              <GameTime scheduledAt={p.scheduledAt} />
            </div>
          ) : (
            <Clock aria-hidden className="text-text-secondary size-7" />
          )}
        </div>
      </div>
      {(p.conversationCount !== undefined || p.broadcast) && (
        <div className="border-border-subtle text-text-secondary mt-5 flex items-center justify-between gap-2 border-t pt-3 text-sm">
          {p.conversationCount !== undefined ? (
            <span className="flex items-center gap-2">
              <Flame aria-hidden className="text-brand size-4" />
              {p.conversationCount} fan takes
            </span>
          ) : (
            <span />
          )}
          {p.broadcast && (
            <span className="text-text-muted shrink-0 text-xs font-bold uppercase">
              {p.broadcast}
            </span>
          )}
        </div>
      )}
    </Card>
  );
  return href ? (
    <Link
      href={href}
      aria-label={`Open ${p.awayTeam} at ${p.homeTeam}`}
      className="focus-visible:outline-brand block rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {card}
    </Link>
  ) : (
    card
  );
}
