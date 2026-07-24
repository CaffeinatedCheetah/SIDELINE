import { Clock, Flame } from "lucide-react";
import Link from "next/link";
import { Badge, Card } from "@/components/ui/foundations";

export interface GameCardProps {
  id: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  homeScore?: number;
  awayScore?: number;
  status: "SCHEDULED" | "LIVE" | "FINAL" | "POSTPONED" | "CANCELED";
  statusText: string;
  conversationCount?: number;
  featured?: boolean;
}
export function GameCard(p: GameCardProps) {
  const hasScore = p.homeScore !== undefined && p.awayScore !== undefined;
  return (
    <Card
      className={`group hover:border-border-strong hover:bg-surface-3 relative overflow-hidden transition ${p.featured ? "p-6" : ""}`}
    >
      <div className="mb-4 flex items-center justify-between">
        <span className="text-text-muted text-xs font-bold tracking-wider uppercase">
          {p.league}
        </span>
        <Badge tone={p.status === "LIVE" ? "live" : "neutral"}>
          {p.statusText}
        </Badge>
      </div>
      <Link
        href={`/games/${p.id}`}
        className="after:absolute after:inset-0 after:content-['']"
      >
        <span className="sr-only">
          Open {p.awayTeam} at {p.homeTeam}
        </span>
      </Link>
      <div className="grid grid-cols-[1fr_auto] items-center gap-3">
        <div className="grid gap-3">
          <div className="flex items-center gap-2 font-bold">
            {p.awayTeamLogo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.awayTeamLogo}
                alt=""
                aria-hidden
                className="size-6 shrink-0 object-contain"
              />
            )}
            {p.awayTeam}
          </div>
          <div className="flex items-center gap-2 font-bold">
            {p.homeTeamLogo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.homeTeamLogo}
                alt=""
                aria-hidden
                className="size-6 shrink-0 object-contain"
              />
            )}
            {p.homeTeam}
          </div>
        </div>
        <div className="font-display grid gap-1 text-right text-3xl font-black tabular-nums">
          {hasScore ? (
            <>
              <span>{p.awayScore}</span>
              <span>{p.homeScore}</span>
            </>
          ) : (
            <Clock aria-hidden className="text-text-secondary size-7" />
          )}
        </div>
      </div>
      {p.conversationCount !== undefined && (
        <div className="border-border-subtle text-text-secondary mt-5 flex items-center gap-2 border-t pt-3 text-sm">
          <Flame aria-hidden className="text-brand size-4" />
          {p.conversationCount} fan takes
        </div>
      )}
    </Card>
  );
}
