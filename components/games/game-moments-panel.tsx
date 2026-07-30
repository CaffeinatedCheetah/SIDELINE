"use client";

import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Clock3,
  Flame,
  MessageCircle,
  Radio,
  RefreshCw,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { TakeComposer } from "@/components/actions/take-composer";
import { TakeCard } from "@/components/takes/take-card";
import { Badge, Card } from "@/components/ui/foundations";
import { LocalDateTime } from "@/components/ui/local-date-time";
import type { GamePhase } from "@/lib/sports/game-lifecycle";
import { cn } from "@/lib/utils";

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

type MomentPresentation = {
  Icon: LucideIcon;
  label: string;
  accent: string;
  surface: string;
  node: string;
};

function momentPresentation(moment: Moment): MomentPresentation {
  const type = moment.type.toUpperCase();
  const label = type.replaceAll("_", " ").toLowerCase();
  if (type === "GAME_END" || type === "FINAL" || type === "GAME_WINNING_PLAY")
    return {
      Icon: Trophy,
      label,
      accent: "text-warning",
      surface: "border-warning/40 bg-warning/8",
      node: "bg-warning text-black",
    };
  if (type === "PENALTY" || type === "EJECTION" || type === "RED_CARD")
    return {
      Icon: AlertTriangle,
      label,
      accent: "text-danger",
      surface: "border-danger/35 bg-danger/8",
      node: "bg-danger text-black",
    };
  if (
    type === "PITCHING_CHANGE" ||
    type === "SUBSTITUTION" ||
    type === "TURNOVER"
  )
    return {
      Icon: RefreshCw,
      label,
      accent: "text-info",
      surface: "border-info/30 bg-info/8",
      node: "bg-info text-black",
    };
  if (type === "TIMEOUT" || type === "PERIOD_END")
    return {
      Icon: Clock3,
      label,
      accent: "text-text-secondary",
      surface: "border-border-strong bg-surface-3/70",
      node: "bg-surface-3 text-text-primary",
    };
  if (type === "HOME_RUN" || type === "LEAD_CHANGE" || type === "TIE")
    return {
      Icon: Flame,
      label,
      accent: "text-brand",
      surface: "border-brand/40 bg-brand/10",
      node: "bg-brand text-white",
    };
  if (type === "SCORE")
    return {
      Icon: Target,
      label,
      accent: "text-success",
      surface: "border-success/35 bg-success/8",
      node: "bg-success text-black",
    };
  if (moment.importance >= 70)
    return {
      Icon: Sparkles,
      label,
      accent: "text-brand",
      surface: "border-brand/40 bg-brand/10",
      node: "bg-brand text-white",
    };
  return {
    Icon: Radio,
    label,
    accent: "text-text-secondary",
    surface: "border-border-subtle bg-surface-2/80",
    node: "bg-surface-3 text-text-secondary",
  };
}

function MomentScore({ moment }: { moment: Moment }) {
  if (moment.awayScore === null || moment.homeScore === null) return null;
  return (
    <span
      className="border-border-strong bg-surface-1/80 rounded-full border px-2.5 py-1 text-xs font-black tabular-nums"
      aria-label={`Score ${moment.awayScore} to ${moment.homeScore}`}
    >
      {moment.awayScore}–{moment.homeScore}
    </span>
  );
}

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
    <section
      aria-labelledby="game-moments-title"
      className="mb-8 grid gap-6"
      data-game-moments-panel
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-brand text-xs font-bold tracking-[0.18em] uppercase">
            {archive ? "Permanent game archive" : "Live event conversation"}
          </p>
          <h2
            id="game-moments-title"
            className="font-display text-3xl font-black"
          >
            Game Moments
          </h2>
        </div>
        <p
          role="status"
          aria-live="polite"
          className={cn(
            "flex items-center gap-2 text-xs font-semibold",
            updateState === "delayed" ? "text-warning" : "text-text-muted",
          )}
        >
          <Radio
            aria-hidden
            className={cn(
              "size-3.5",
              updateState === "checking" && "motion-safe:animate-pulse",
            )}
          />
          {updateState === "checking"
            ? "Checking for moments"
            : updateState === "delayed"
              ? "Live updates delayed"
              : archive
                ? "Archive current"
                : "Live updates on"}
        </p>
      </div>

      {featuredThread ? (
        <Card
          className="border-brand/50 relative overflow-hidden rounded-2xl bg-[linear-gradient(135deg,var(--brand-surface),var(--surface-2)_58%,color-mix(in_srgb,var(--info)_10%,var(--surface-2)))] p-0 shadow-xl md:p-0"
          data-featured-flash-thread
        >
          <div
            aria-hidden
            className="bg-brand/15 absolute -top-20 -right-16 size-52 rounded-full blur-3xl"
          />
          <div className="border-brand/25 relative flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
            <Badge tone="live" className="gap-2 px-3 py-1.5 uppercase">
              <span
                aria-hidden
                className="size-2 rounded-full bg-white motion-safe:animate-pulse"
              />
              Flash Thread
            </Badge>
            <span className="text-text-secondary flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase">
              <MessageCircle aria-hidden className="text-brand size-3.5" />
              {featuredThread.status}
            </span>
          </div>
          <div className="relative p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-text-muted text-xs font-bold tracking-[0.16em] uppercase">
                  Fans are talking now
                </p>
                <h3 className="font-display mt-2 max-w-4xl text-2xl leading-tight font-black text-balance sm:text-4xl">
                  {featuredThread.title}
                </h3>
              </div>
              <MomentScore moment={featuredThread.moment} />
            </div>
            <p className="text-text-secondary mt-3 flex flex-wrap items-center gap-2 text-sm">
              <Clock3 aria-hidden className="text-brand size-4" />
              {[featuredThread.moment.period, featuredThread.moment.clock]
                .filter(Boolean)
                .join(" · ") || "Verified game moment"}
            </p>
            <div className="mt-5 grid grid-cols-3 gap-2 sm:max-w-xl sm:gap-3">
              {[
                ["Takes", featuredThread.takeCount],
                ["Reactions", featuredThread.reactionCount],
                ["Replies", featuredThread.replyCount],
              ].map(([label, count]) => (
                <div
                  key={label}
                  className="border-border-subtle bg-surface-1/55 rounded-xl border p-3 text-center"
                >
                  <strong className="font-display block text-xl font-black tabular-nums sm:text-2xl">
                    {count}
                  </strong>
                  <span className="text-text-muted text-[0.65rem] font-bold tracking-wide uppercase">
                    {label}
                  </span>
                </div>
              ))}
            </div>
            {featuredThread.status === "ACTIVE" && !archive ? (
              <div className="border-brand/25 bg-surface-1/45 mt-6 rounded-xl border p-3 sm:p-4">
                <TakeComposer
                  gameId={gameId}
                  flashThreadId={featuredThread.id}
                  onPosted={refresh}
                />
              </div>
            ) : (
              <p className="border-border-subtle bg-surface-1/45 text-text-muted mt-6 rounded-xl border p-4 text-sm">
                This Flash Thread is preserved as a read-only game archive.
              </p>
            )}
            {featuredThread.takes.length ? (
              <div className="mt-6 grid gap-4">
                {featuredThread.takes.slice(0, 3).map((take) => (
                  <div
                    key={take.id}
                    className="border-border-subtle bg-surface-1/40 rounded-xl border p-1"
                  >
                    <TakeCard
                      id={take.id}
                      author={{
                        handle: take.author.handle,
                        displayName: take.author.displayName,
                        avatarUrl: take.author.image,
                      }}
                      body={take.body}
                      context={[
                        featuredThread.moment.period,
                        featuredThread.title,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      createdAt=""
                      createdAtIso={take.createdAt}
                      reactions={take._count.reactions + take._count.votes}
                      replies={take._count.replies}
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </Card>
      ) : (
        <Card className="border-brand/25 relative grid min-h-48 place-items-center overflow-hidden rounded-2xl bg-[linear-gradient(135deg,var(--brand-surface),var(--surface-2))] px-5 py-10 text-center">
          <div
            aria-hidden
            className="bg-brand/15 absolute -top-16 size-44 rounded-full blur-3xl"
          />
          <div className="relative">
            <span className="border-brand/30 bg-brand-surface text-brand mx-auto grid size-12 place-items-center rounded-2xl border">
              <Radio aria-hidden className="size-6" />
            </span>
            <h3 className="mt-4 text-xl font-black">No major moments yet</h3>
            <p className="text-text-secondary mx-auto mt-2 max-w-lg">
              {archive
                ? "This game’s verified moments will remain here as a permanent archive."
                : "Major game moments will appear here as the action unfolds."}
            </p>
          </div>
        </Card>
      )}

      <Card className="border-border-strong bg-surface-1/65 rounded-2xl p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-text-muted text-xs font-bold tracking-[0.16em] uppercase">
              Verified play-by-play
            </p>
            <h3 className="font-display mt-1 text-2xl font-black">
              {archive ? "Game timeline" : "Recent moments"}
            </h3>
          </div>
          {timeline.length ? (
            <span className="text-text-muted text-xs">
              {timeline.length} {timeline.length === 1 ? "moment" : "moments"}
            </span>
          ) : null}
        </div>
        {timeline.length ? (
          <ol className="mt-6 grid" data-moments-timeline>
            {timeline.map((moment, index) => {
              const presentation = momentPresentation(moment);
              const Icon = presentation.Icon;
              const major = moment.importance >= 70;
              return (
                <li
                  key={moment.id}
                  className="relative grid grid-cols-[2.75rem_minmax(0,1fr)] gap-3 pb-5 last:pb-0 sm:grid-cols-[3rem_minmax(0,1fr)] sm:gap-4"
                  data-moment-type={moment.type}
                  data-moment-importance={major ? "major" : "standard"}
                >
                  {index < timeline.length - 1 ? (
                    <span
                      aria-hidden
                      className="from-brand/60 to-border-subtle absolute top-10 bottom-0 left-[1.35rem] w-px bg-gradient-to-b sm:left-[1.48rem]"
                    />
                  ) : null}
                  <span
                    className={cn(
                      "relative z-10 grid size-11 place-items-center rounded-2xl border border-white/10 shadow-md sm:size-12",
                      presentation.node,
                    )}
                  >
                    <Icon aria-hidden className="size-5" />
                  </span>
                  <article
                    className={cn(
                      "min-w-0 rounded-xl border p-4",
                      major && "shadow-lg",
                      presentation.surface,
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "text-[0.65rem] font-black tracking-[0.15em] uppercase",
                              presentation.accent,
                            )}
                          >
                            {presentation.label}
                          </span>
                          {major ? (
                            <span className="border-brand/30 bg-brand-surface text-brand rounded-full border px-2 py-0.5 text-[0.65rem] font-bold uppercase">
                              Major moment
                            </span>
                          ) : null}
                        </div>
                        <h4 className="mt-1 font-bold text-balance sm:text-lg">
                          {moment.title}
                        </h4>
                      </div>
                      <MomentScore moment={moment} />
                    </div>
                    {moment.description ? (
                      <p className="text-text-secondary mt-2 text-sm leading-relaxed">
                        {moment.description}
                      </p>
                    ) : null}
                    <p className="text-text-muted mt-3 flex flex-wrap items-center gap-2 text-xs">
                      <Clock3 aria-hidden className="size-3.5" />
                      {[moment.period, moment.clock]
                        .filter(Boolean)
                        .join(" · ") || "Game update"}
                      <span aria-hidden>·</span>
                      <LocalDateTime value={moment.occurredAt} />
                    </p>
                  </article>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-text-secondary border-border-strong bg-surface-2/60 mt-4 rounded-xl border border-dashed p-6 text-center text-sm">
            Verified provider moments will build this timeline.
          </p>
        )}
      </Card>
    </section>
  );
}
