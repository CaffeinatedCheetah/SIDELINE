"use client";
import { MessageCircle, Share2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { TakeComposer } from "@/components/actions/take-composer";
import {
  ReactionPicker,
  type LiveReactionKind,
} from "@/components/reactions/reaction-picker";
import { Avatar, Card } from "@/components/ui/foundations";
import { LocalDateTime } from "@/components/ui/local-date-time";
import { Modal } from "@/components/ui/modal";
import { MentionText } from "@/components/social/mention-text";
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
  initialReactionCounts?: Partial<Record<LiveReactionKind, number>>;
  initialReactionKinds?: LiveReactionKind[];
  /** Backward-compatible Fire state for existing server read models. */
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
  initialReactionCounts,
  initialReactionKinds,
  initialReacted = false,
}: TakeCardProps) {
  const [replyCount, setReplyCount] = useState(replies);
  const [shared, setShared] = useState(false);

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
              href={`/u/${author.handle}`}
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
        <p className="mt-3 text-base leading-6 whitespace-pre-wrap">
          <MentionText>{body}</MentionText>
        </p>
        <footer className="border-border-subtle mt-4 flex items-center gap-1 border-t pt-2">
          <ReactionPicker
            takeId={id}
            initialTotal={reactions}
            initialCounts={initialReactionCounts}
            initialActive={
              initialReactionKinds ?? (initialReacted ? ["FIRE"] : [])
            }
          />
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
