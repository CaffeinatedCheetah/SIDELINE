import { Clock, Flame } from "lucide-react";
import Link from "next/link";
import { Badge, Card } from "@/components/ui/foundations";
import { LocalDateTime } from "@/components/ui/local-date-time";

export interface GameCardProps {
  id: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  homeLogoUrl?: string | null;
  awayLogoUrl?: string | null;
  homeScore?: number;
  awayScore?: number;
  status: "SCHEDULED" | "LIVE" | "FINAL" | "POSTPONED" | "CANCELED";
  statusText: string;
  conversationCount?: number;
  scheduledAt?: string;
  broadcast?: string | null;
  featured?: boolean;
}
export function GameCard(p: GameCardProps) {
  const hasScore = p.homeScore !== undefined && p.awayScore !== undefined;
  return (
    <Link
      href={`/games/${p.id}`}
      aria-label={`Open ${p.awayTeam} at ${p.homeTeam}`}
      className="focus-visible:outline-brand block rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2"
    >
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
        <div className="grid grid-cols-[1fr_auto] items-center gap-3">
          <div className="grid gap-3">
            <Team name={p.awayTeam} logoUrl={p.awayLogoUrl} />
            <Team name={p.homeTeam} logoUrl={p.homeLogoUrl} />
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
        {!hasScore && p.scheduledAt && (
          <p className="text-text-secondary mt-4 text-sm">
            <LocalDateTime value={p.scheduledAt} calendar />
            {p.broadcast ? ` · ${p.broadcast}` : ""}
          </p>
        )}
        {p.conversationCount !== undefined && (
          <div className="border-border-subtle text-text-secondary mt-5 flex items-center gap-2 border-t pt-3 text-sm">
            <Flame aria-hidden className="text-brand size-4" />
            {p.conversationCount} fan takes
          </div>
        )}
      </Card>
    </Link>
  );
}

function Team({ name, logoUrl }: { name: string; logoUrl?: string | null }) {
  return (
    <div className="flex items-center gap-2 font-bold">
      {logoUrl ? (
        // Provider logos are content, not layout-critical imagery.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          className="provider-logo size-7 object-contain"
        />
      ) : null}
      <span>{name}</span>
    </div>
  );
}
