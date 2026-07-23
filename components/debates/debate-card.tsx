import { MessageCircle, Users } from "lucide-react";
import Link from "next/link";

import { Badge, Card } from "@/components/ui/foundations";
import { formatCount } from "@/lib/utils";

export interface DebateCardProps {
  id: string;
  title: string;
  category: string;
  options: readonly { label: string; votes: number }[];
  replyCount: number;
  closesAt?: string;
}

export function DebateCard({
  id,
  title,
  category,
  options,
  replyCount,
  closesAt,
}: DebateCardProps) {
  const total = options.reduce((sum, option) => sum + option.votes, 0);

  return (
    <Card className="hover:border-border-strong hover:bg-surface-3 relative transition">
      <article aria-labelledby={`debate-${id}`}>
        <div className="flex items-center justify-between gap-3">
          <Badge>{category}</Badge>
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
        <div className="mt-4 grid gap-2">
          {options.slice(0, 3).map((option) => (
            <div key={option.label} className="flex justify-between text-sm">
              <span>{option.label}</span>
              <span className="font-bold tabular-nums">
                {total ? Math.round((option.votes / total) * 100) : 0}%
              </span>
            </div>
          ))}
        </div>
        <footer className="border-border-subtle text-text-secondary mt-4 flex gap-4 border-t pt-3 text-sm">
          <span className="flex items-center gap-2">
            <Users aria-hidden className="size-4" />
            {formatCount(total)} votes
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
