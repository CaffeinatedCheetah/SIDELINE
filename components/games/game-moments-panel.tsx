"use client";

import { Clock3, Flame, Radio } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { TakeComposer } from "@/components/actions/take-composer";
import { TakeCard } from "@/components/takes/take-card";
import { Badge, Card, EmptyState } from "@/components/ui/foundations";
import { LocalDateTime } from "@/components/ui/local-date-time";
import type { GamePhase } from "@/lib/sports/game-lifecycle";

type Moment = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  period: string | null;
  clock: string | null;
  homeScore: number | null;
  awayScore: number | null;
  importance: number;
  occurredAt: string;
};

type ThreadTake = {
  id: string;
  body: string;
  createdAt: string;
  author: { handle: string; displayName: string; image: string | null };
  _count: { reactions: number; replies: number; votes: number };
};

type FlashThread = {
  id: string;
  title: string;
  status: "ACTIVE" | "ARCHIVED";
  moment: Moment;
  takes: ThreadTake[];
  takeCount: number;
  reactionCount: number;
  replyCount: number;
};

export function GameMomentsPanel({
  gameId,
  phase,
  initialMoments,
  initialThreads,
}: {
  gameId: string;
  phase: GamePhase;
  initialMoments: Moment[];
  initialThreads: FlashThread[];
}) {
  const [moments, setMoments] = useState(initialMoments);
  const [threads, setThreads] = useState(initialThreads);
  const [updateState, setUpdateState] = useState<
    "current" | "checking" | "delayed"
  >("current");
  const refresh = useCallback(async () => {
    setUpdateState("checking");
    try {
      const [momentsResponse, threadsResponse] = await Promise.all([
        fetch(`/api/games/${gameId}/moments`, { cache: "no-store" }),
        fetch(`/api/games/${gameId}/flash-threads`, { cache: "no-store" }),
      ]);
      if (!momentsResponse.ok || !threadsResponse.ok)
        throw new Error("Moment refresh failed.");
      const [momentBody, threadBody] = (await Promise.all([
        momentsResponse.json(),
        threadsResponse.json(),
      ])) as [{ data: Moment[] }, { data: FlashThread[] }];
      setMoments(momentBody.data);
      setThreads(threadBody.data);
      setUpdateState("current");
    } catch {
      setUpdateState("delayed");
    }
  }, [gameId]);

  useEffect(() => {
    if (!["LIVE", "HALFTIME", "PREGAME"].includes(phase)) return;
    const timer = window.setInterval(refresh, 10_000);
    return () => window.clearInterval(timer);
  }, [phase, refresh]);

  const archive = phase === "FINAL";
  const featuredThread = useMemo(
    () =>
      [...threads]
        .filter((thread) => archive || thread.status === "ACTIVE")
        .sort(
          (left, right) =>
            new Date(right.moment.occurredAt).getTime() -
            new Date(left.moment.occurredAt).getTime(),
        )[0],
    [archive, threads],
  );
  const timeline = useMemo(
    () =>
      [...moments].sort((left, right) => {
        const difference =
          new Date(left.occurredAt).getTime() -
          new Date(right.occurredAt).getTime();
        return archive ? difference : -difference;
      }),
    [archive, moments],
  );

  return (
    <section aria-labelledby="game-moments-title" className="mb-8 grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-brand text-xs font-bold tracking-wider uppercase">
            Live event conversation
          </p>
          <h2
            id="game-moments-title"
            className="font-display text-2xl font-black"
          >
            Flash Threads
          </h2>
        </div>
        <p role="status" className="text-text-muted text-xs">
          {updateState === "checking"
            ? "Checking for moments"
            : updateState === "delayed"
              ? "Live updates delayed"
              : archive
                ? "Permanent game archive"
                : "Live updates on"}
        </p>
      </div>

      {featuredThread ? (
        <Card className="border-brand/50 overflow-hidden p-0">
          <div className="bg-brand/10 border-brand/20 flex items-center justify-between gap-3 border-b px-5 py-3">
            <Badge tone="live">Flash Thread</Badge>
            <span className="text-text-muted flex items-center gap-1.5 text-xs">
              <Radio aria-hidden className="size-3.5" />
              {featuredThread.status}
            </span>
          </div>
          <div className="p-5">
            <h3 className="font-display text-2xl font-black">
              {featuredThread.title}
            </h3>
            <p className="text-text-secondary mt-2">
              {[featuredThread.moment.period, featuredThread.moment.clock]
                .filter(Boolean)
                .join(" · ")}
              {featuredThread.moment.homeScore !== null &&
              featuredThread.moment.awayScore !== null
                ? ` · ${featuredThread.moment.awayScore}–${featuredThread.moment.homeScore}`
                : ""}
            </p>
            <div className="text-text-muted mt-3 flex flex-wrap gap-4 text-sm">
              <span>{featuredThread.takeCount} Takes</span>
              <span>{featuredThread.reactionCount} reactions</span>
              <span>{featuredThread.replyCount} replies</span>
            </div>
            {featuredThread.status === "ACTIVE" && !archive ? (
              <div className="mt-5">
                <TakeComposer
                  gameId={gameId}
                  flashThreadId={featuredThread.id}
                  onPosted={refresh}
                />
              </div>
            ) : (
              <p className="text-text-muted mt-5 text-sm">
                This Flash Thread is preserved as a read-only game archive.
              </p>
            )}
            {featuredThread.takes.length ? (
              <div className="mt-5 grid gap-4">
                {featuredThread.takes.slice(0, 3).map((take) => (
                  <TakeCard
                    key={take.id}
                    id={take.id}
                    author={{
                      handle: take.author.handle,
                      displayName: take.author.displayName,
                      avatarUrl: take.author.image,
                    }}
                    body={take.body}
                    context={[featuredThread.moment.period, featuredThread.title]
                      .filter(Boolean)
                      .join(" · ")}
                    createdAt=""
                    createdAtIso={take.createdAt}
                    reactions={take._count.reactions + take._count.votes}
                    replies={take._count.replies}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </Card>
      ) : (
        <EmptyState
          title="No major moments yet"
          description="Major game moments will appear here as the action unfolds."
        />
      )}

      <Card>
        <h3 className="font-display text-xl font-black">
          {archive ? "Game timeline" : "Recent moments"}
        </h3>
        {timeline.length ? (
          <ol className="border-border-subtle mt-4 grid border-l pl-5">
            {timeline.map((moment) => (
              <li key={moment.id} className="relative pb-5 last:pb-0">
                <span className="bg-brand absolute top-1.5 -left-[1.55rem] size-2.5 rounded-full" />
                <div className="flex flex-wrap items-center gap-2">
                  <strong>{moment.title}</strong>
                  {moment.importance >= 70 ? (
                    <Flame
                      aria-label="Major moment"
                      className="text-brand size-4"
                    />
                  ) : null}
                </div>
                <p className="text-text-muted mt-1 flex flex-wrap items-center gap-2 text-xs">
                  <Clock3 aria-hidden className="size-3.5" />
                  {[moment.period, moment.clock].filter(Boolean).join(" · ")}
                  <span>·</span>
                  <LocalDateTime value={moment.occurredAt} />
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-text-secondary mt-3 text-sm">
            Verified provider moments will build this timeline.
          </p>
        )}
      </Card>
    </section>
  );
}
