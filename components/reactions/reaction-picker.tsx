"use client";

import { useState } from "react";

import { apiAction } from "@/components/actions/api-action";
import { cn, formatCount } from "@/lib/utils";

export const REACTION_OPTIONS = [
  { kind: "LOVE", label: "Love", symbol: "❤️" },
  { kind: "FIRE", label: "Fire", symbol: "🔥" },
  { kind: "FUNNY", label: "Funny", symbol: "😂" },
  { kind: "WOW", label: "Wow", symbol: "😮" },
  { kind: "DISAGREE", label: "Disagree", symbol: "👎" },
] as const;

export type LiveReactionKind = (typeof REACTION_OPTIONS)[number]["kind"];

type ReactionCounts = Partial<Record<LiveReactionKind, number>>;

export function ReactionPicker({
  takeId,
  initialTotal,
  initialCounts = {},
  initialActive = [],
}: {
  takeId: string;
  initialTotal: number;
  initialCounts?: ReactionCounts;
  initialActive?: LiveReactionKind[];
}) {
  const [counts, setCounts] = useState<ReactionCounts>(initialCounts);
  const [active, setActive] = useState(() => new Set(initialActive));
  const [pending, setPending] = useState<LiveReactionKind | null>(null);
  const [total, setTotal] = useState(initialTotal);
  const [message, setMessage] = useState("");

  async function toggle(kind: LiveReactionKind) {
    if (pending) return;
    const wasActive = active.has(kind);
    const delta = wasActive ? -1 : 1;
    const nextActive = new Set(active);
    if (wasActive) nextActive.delete(kind);
    else nextActive.add(kind);
    setPending(kind);
    setActive(nextActive);
    setCounts((current) => ({
      ...current,
      [kind]: Math.max(0, (current[kind] ?? 0) + delta),
    }));
    setTotal((current) => Math.max(0, current + delta));
    setMessage(
      `${REACTION_OPTIONS.find((item) => item.kind === kind)?.label} ${wasActive ? "removed" : "added"}`,
    );

    try {
      await apiAction("reactions", { takeId, kind });
    } catch (error) {
      setActive(active);
      setCounts((current) => ({
        ...current,
        [kind]: Math.max(0, (current[kind] ?? 0) - delta),
      }));
      setTotal((current) => Math.max(0, current - delta));
      setMessage("Reaction could not be updated.");
      if (error instanceof Error && error.message === "AUTH_REQUIRED") return;
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex min-w-0 items-center gap-1" data-reaction-picker>
      <div
        className="border-border-subtle bg-surface-2/70 flex flex-wrap items-center gap-0.5 rounded-full border p-1"
        aria-label={`${formatCount(total)} reactions`}
      >
        {REACTION_OPTIONS.map(({ kind, label, symbol }) => {
          const selected = active.has(kind);
          const count = counts[kind] ?? 0;
          return (
            <button
              key={kind}
              type="button"
              aria-label={`${selected ? "Remove" : "Add"} ${label} reaction${count ? `, ${formatCount(count)} ${label}` : ""}`}
              aria-pressed={selected}
              disabled={pending !== null}
              onClick={() => void toggle(kind)}
              className={cn(
                "focus-visible:ring-focus inline-flex min-h-9 min-w-9 items-center justify-center gap-1 rounded-full px-2 text-sm transition focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60 motion-reduce:transition-none",
                selected
                  ? "bg-brand-surface text-text shadow-sm"
                  : "hover:bg-surface-3",
              )}
            >
              <span aria-hidden className="text-base leading-none">
                {symbol}
              </span>
              {count > 0 ? (
                <span className="text-[0.7rem] font-bold tabular-nums">
                  {formatCount(count)}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <span className="text-text-muted shrink-0 text-xs font-semibold tabular-nums">
        {formatCount(total)}
      </span>
      <span className="sr-only" role="status" aria-live="polite">
        {message}
      </span>
    </div>
  );
}
