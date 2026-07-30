import { ArrowRight, MessageCircle, TrendingUp, Users } from "lucide-react";
import Link from "next/link";

import { Badge, Card } from "@/components/ui/foundations";
import { formatCount } from "@/lib/utils";

export interface DebateCardProps {
  id: string;
  title: string;
  category: string;
  /** Only real when the debate is attached to a real Game -- a debate with
   * no gameId has no league at all in this data model, so this stays
   * undefined rather than showing a fabricated/generic badge. */
  league?: string;
  options: readonly { label: string; votes: number }[];
  replyCount: number;
  closesAt?: string;
}

export function DebateCard({
  id,
  title,
  category,
  league,
  options,
  replyCount,
  closesAt,
}: DebateCardProps) {
  const total = options.reduce((sum, option) => sum + option.votes, 0);
  const leading = [...options].sort((a, b) => b.votes - a.votes)[0];

  return (
    <Card className="hover:border-brand/35 bg-surface-1/90 group relative overflow-hidden rounded-2xl transition hover:-translate-y-0.5 hover:shadow-xl motion-reduce:transform-none">
      <article aria-labelledby={`debate-${id}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge>{category}</Badge>
            {league && <Badge tone="neutral">{league}</Badge>}
          </div>
          {closesAt && (
            <span className="text-text-muted text-xs">Closes {closesAt}</span>
          )}
        </div>
        <h3
          id={`debate-${id}`}
          className="font-display mt-3 text-xl font-black"
        >
          <Link
            href={`/debates/${id}`}
            className="after:absolute after:inset-0"
          >
            {title}
          </Link>
        </h3>
        {leading && total > 0 ? (
          <p className="text-success mt-3 flex items-center gap-1.5 text-xs font-bold">
            <TrendingUp aria-hidden className="size-3.5" />
            Leading opinion: {leading.label}
          </p>
        ) : null}
        <div className="mt-4 grid gap-3">
          {options.slice(0, 3).map((option) => (
            <div key={option.label}>
              <div className="mb-1 flex justify-between gap-3 text-sm">
                <span className="truncate">{option.label}</span>
                <span className="font-bold tabular-nums">
                  {total ? Math.round((option.votes / total) * 100) : 0}%
                </span>
              </div>
              <div
                className="bg-surface-3 h-1.5 overflow-hidden rounded-full"
                role="img"
                aria-label={`${option.label}: ${option.votes} votes`}
              >
                <span
                  className="bg-brand block h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
                  style={{
                    width: `${total ? (option.votes / total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        <footer className="border-border-subtle text-text-secondary mt-4 flex gap-4 border-t pt-3 text-sm">
          <span className="flex items-center gap-2">
            <Users aria-hidden className="size-4" />
            {formatCount(total)} votes
          </span>
          <span className="text-brand ml-auto flex items-center gap-1 font-bold">
            Join debate
            <ArrowRight
              aria-hidden
              className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none"
            />
          </span>
          <span className="flex items-center gap-2">
            <MessageCircle aria-hidden className="size-4" />
            {formatCount(replyCount)} replies
          </span>
        </footer>
      </article>
    </Card>
  );
}
