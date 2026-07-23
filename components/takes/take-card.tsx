import { Flame, MessageCircle, MoreHorizontal, Share2 } from "lucide-react";
import Link from "next/link";
import { Avatar, Card } from "@/components/ui/foundations";
import { formatCount } from "@/lib/utils";
export interface TakeCardProps {
  id: string;
  author: { handle: string; displayName: string; avatarUrl?: string | null };
  body: string;
  context?: string;
  createdAt: string;
  reactions: number;
  replies: number;
}
export function TakeCard({
  id,
  author,
  body,
  context,
  createdAt,
  reactions,
  replies,
}: TakeCardProps) {
  return (
    <Card className="hover:border-border-strong transition">
      <article aria-labelledby={`take-${id}-author`}>
        <header className="flex gap-3">
          <Avatar name={author.displayName} src={author.avatarUrl} />
          <div className="min-w-0">
            <Link
              id={`take-${id}-author`}
              href={`/users/${author.handle}`}
              className="font-bold hover:underline"
            >
              {author.displayName}
            </Link>
            <div className="text-text-muted text-sm">
              @{author.handle} · <time>{createdAt}</time>
            </div>
          </div>
          <button
            aria-label="More actions"
            className="hover:bg-surface-3 ml-auto grid size-11 place-items-center rounded-sm"
          >
            <MoreHorizontal aria-hidden className="size-5" />
          </button>
        </header>
        {context && (
          <p className="text-brand mt-3 text-xs font-bold tracking-wider uppercase">
            {context}
          </p>
        )}
        <p className="mt-3 text-base leading-6 whitespace-pre-wrap">{body}</p>
        <footer className="border-border-subtle mt-4 flex items-center gap-1 border-t pt-2">
          <button
            aria-label={`${reactions} flames`}
            aria-pressed="false"
            className="hover:bg-surface-3 flex min-h-11 items-center gap-2 rounded-sm px-3 text-sm"
          >
            <Flame aria-hidden className="size-5" />
            {formatCount(reactions)}
          </button>
          <button className="hover:bg-surface-3 flex min-h-11 items-center gap-2 rounded-sm px-3 text-sm">
            <MessageCircle aria-hidden className="size-5" />
            {formatCount(replies)}
            <span className="sr-only"> replies</span>
          </button>
          <button
            aria-label="Share take"
            className="hover:bg-surface-3 grid size-11 place-items-center rounded-sm"
          >
            <Share2 aria-hidden className="size-5" />
          </button>
        </footer>
      </article>
    </Card>
  );
}
