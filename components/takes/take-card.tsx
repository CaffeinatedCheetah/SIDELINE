"use client";
import { Flame, MessageCircle, Share2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { apiAction } from "@/components/actions/api-action";
import { TakeComposer } from "@/components/actions/take-composer";
import { Avatar, Card } from "@/components/ui/foundations";
import { LocalDateTime } from "@/components/ui/local-date-time";
import { Modal } from "@/components/ui/modal";
import { formatCount } from "@/lib/utils";
export interface TakeCardProps {
  id: string;
  author: { handle: string; displayName: string; avatarUrl?: string | null };
  body: string;
  context?: string;
  createdAt: string;
  createdAtIso?: string;
  reactions: number;
  replies: number;
  initialReacted?: boolean;
}
export function TakeCard({
  id,
  author,
  body,
  context,
  createdAt,
  createdAtIso,
  reactions,
  replies,
  initialReacted = false,
}: TakeCardProps) {
  const [reacted, setReacted] = useState(initialReacted);
  const [reactionCount, setReactionCount] = useState(reactions);
  const [reacting, setReacting] = useState(false);
  const [replyCount, setReplyCount] = useState(replies);
  const [shared, setShared] = useState(false);

  async function toggleReaction() {
    if (reacting) return;
    setReacting(true);
    const nextReacted = !reacted;
    setReacted(nextReacted);
    setReactionCount((count) => count + (nextReacted ? 1 : -1));
    try {
      await apiAction("reactions", { takeId: id, kind: "FIRE" });
    } catch (error) {
      // Roll back on failure (including the redirect-to-sign-in case, where
      // the count should never have moved in the first place).
      setReacted(!nextReacted);
      setReactionCount((count) => count + (nextReacted ? -1 : 1));
      if (error instanceof Error && error.message === "AUTH_REQUIRED") return;
    } finally {
      setReacting(false);
    }
  }

  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch {
      // Clipboard access can be denied by the browser; nothing useful to
      // recover into, so just leave the button inert for this click.
    }
  }

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
              @{author.handle} ·{" "}
              {createdAtIso ? (
                <LocalDateTime value={createdAtIso} />
              ) : (
                <time>{createdAt}</time>
              )}
            </div>
          </div>
        </header>
        {context && (
          <p className="text-brand mt-3 text-xs font-bold tracking-wider uppercase">
            {context}
          </p>
        )}
        <p className="mt-3 text-base leading-6 whitespace-pre-wrap">{body}</p>
        <footer className="border-border-subtle mt-4 flex items-center gap-1 border-t pt-2">
          <button
            aria-label={`${reacted ? "Remove flame" : "Give flame"}, ${formatCount(reactionCount)} total`}
            aria-pressed={reacted}
            disabled={reacting}
            onClick={toggleReaction}
            className={`hover:bg-surface-3 flex min-h-11 items-center gap-2 rounded-sm px-3 text-sm disabled:opacity-60 ${reacted ? "text-brand" : ""}`}
          >
            <Flame aria-hidden className="size-5" fill={reacted ? "currentColor" : "none"} />
            {formatCount(reactionCount)}
          </button>
          <Modal
            title="Reply"
            description={`Replying to ${author.displayName}.`}
            trigger={
              <button className="hover:bg-surface-3 flex min-h-11 items-center gap-2 rounded-sm px-3 text-sm">
                <MessageCircle aria-hidden className="size-5" />
                {formatCount(replyCount)}
                <span className="sr-only"> replies</span>
              </button>
            }
          >
            <TakeComposer
              parentId={id}
              onPosted={() => setReplyCount((count) => count + 1)}
            />
          </Modal>
          <button
            aria-label={shared ? "Link copied" : "Copy link to this page"}
            onClick={share}
            className="hover:bg-surface-3 grid size-11 place-items-center rounded-sm"
          >
            <Share2 aria-hidden className="size-5" />
          </button>
          {shared && (
            <span role="status" className="text-text-muted text-xs">
              Link copied
            </span>
          )}
        </footer>
      </article>
    </Card>
  );
}
