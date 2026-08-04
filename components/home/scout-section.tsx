import Link from "next/link";
import { Sparkles, TrendingUp, MessageSquareText } from "lucide-react";

import { Badge, Card, EmptyState } from "@/components/ui/foundations";
import { getScoutHighlights } from "@/lib/db/scout-highlights";

function truncate(value: string, max = 140) {
  if (value.length <= max) return value;
  return `${value.slice(0, max).trimEnd()}…`;
}

function timeAgo(date: Date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export async function ScoutSection() {
  let highlights;
  try {
    highlights = await getScoutHighlights();
  } catch {
    return null; // Don't break the homepage if scout data fails
  }

  const hasTakes = highlights.takes.length > 0;
  const hasDebate = !!highlights.debate;

  if (!hasTakes && !hasDebate) return null;

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-2">
        <Sparkles className="text-brand h-5 w-5" />
        <h2 className="text-lg font-bold">Scout&apos;s Picks</h2>
        <Badge variant="accent" className="text-xs">AI-Generated</Badge>
      </div>

      {hasTakes && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <TrendingUp className="h-4 w-4" />
            <span>Hot Takes</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {highlights.takes.map((take) => (
              <Card key={take.id} className="space-y-2 p-4">
                <p className="text-sm leading-relaxed">{truncate(take.body, 200)}</p>
                <div className="text-text-muted flex items-center gap-3 text-xs">
                  <span>🔥 {take.reactions}</span>
                  <span>💬 {take.replies}</span>
                  <span>{timeAgo(take.createdAt)}</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {hasDebate && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <MessageSquareText className="h-4 w-4" />
            <span>Debate of the Day</span>
          </div>
          <Link href={`/debates/${highlights.debate!.slug}`}>
            <Card className="hover:border-brand space-y-3 p-4 transition-colors">
              <h3 className="font-bold">{highlights.debate!.title}</h3>
              <p className="text-text-muted text-sm">{truncate(highlights.debate!.prompt, 200)}</p>
              <div className="flex flex-wrap gap-2">
                {highlights.debate!.options.map((opt) => (
                  <Badge key={opt.key} variant="outline">{opt.label}</Badge>
                ))}
              </div>
              <p className="text-text-muted text-xs">
                {highlights.debate!.replies} votes · {timeAgo(highlights.debate!.createdAt)}
              </p>
            </Card>
          </Link>
        </div>
      )}
    </section>
  );
}
