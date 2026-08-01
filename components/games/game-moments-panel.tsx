"use client";

import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Clock3,
  Flame,
  MessageCircle,
  MessageSquareText,
  Radio,
  RefreshCw,
  Sparkles,
  Target,
  Trophy,
  Zap,
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
  createdAt?: string;
  moment: Moment;
  takes: ThreadTake[];
  takeCount: number;
  reactionCount: number;
  replyCount: number;
};

type LivePrediction = {
  id: string;
  selection: string;
  status: "OPEN" | "LOCKED" | "RESOLVED" | "CANCELED";
  locksAt: string;
  submittedAt: string;
  resolvedAt: string | null;
  resolvedSelection: string | null;
  outcome: "CORRECT" | "INCORRECT" | "VOID" | null;
  user: { handle: string; displayName: string; image: string | null };
};

type LiveFeedItem = {
  id: string;
  kind: "moment" | "thread" | "take" | "prediction" | "milestone";
  title: string;
  detail?: string | null;
  timestamp: string;
  importance: number;
  featured?: boolean;
  score?: { away: number | null; home: number | null };
  status?: string | null;
  href?: string | null;
};

type MomentPresentation = {
  Icon: LucideIcon;
  label: string;
  accent: string;
  surface: string;
  node: string;
};

function sportMomentLabel(type: string, sportKey?: string) {
  if (type === "SCORE") {
    if (sportKey === "soccer" || sportKey === "hockey") return "goal";
    if (sportKey === "basketball") return "score";
    if (sportKey === "football") return "scoring play";
    if (sportKey === "baseball") return "run scored";
  }
  if (type === "PENALTY" && sportKey === "soccer") return "card or foul";
  if (type === "PERIOD_END") {
    if (sportKey === "baseball") return "inning ended";
    if (sportKey === "football" || sportKey === "basketball")
      return "quarter ended";
    if (sportKey === "hockey") return "period ended";
    if (sportKey === "soccer") return "half ended";
  }
  return type.replaceAll("_", " ").toLowerCase();
}

function momentPresentation(
  moment: Moment,
  sportKey?: string,
): MomentPresentation {
  const type = moment.type.toUpperCase();
  const label = sportMomentLabel(type, sportKey);
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

function predictionLabel(selection: string) {
  if (selection === "home") return "picked the home team";
  if (selection === "away") return "picked the away team";
  return `picked ${selection}`;
}

function buildInitialActivity(
  moments: Moment[],
  threads: FlashThread[],
  predictions: LivePrediction[],
): LiveFeedItem[] {
  const featuredThread = threads[0];
  return [
    ...(featuredThread
      ? [
          {
            id: `thread:${featuredThread.id}`,
            kind: "thread" as const,
            title: featuredThread.title,
            detail: `${featuredThread.takeCount} takes · ${featuredThread.reactionCount} reactions · ${featuredThread.replyCount} replies`,
            timestamp:
              featuredThread.createdAt ?? featuredThread.moment.occurredAt,
            importance: featuredThread.moment.importance,
            featured: true,
            score: {
              away: featuredThread.moment.awayScore,
              home: featuredThread.moment.homeScore,
            },
            status: featuredThread.status,
            href: null,
          },
        ]
      : []),
    ...moments
      .filter((moment) => !threads.some((thread) => thread.moment.id === moment.id))
      .map((moment) => ({
        id: `moment:${moment.id}`,
        kind: "moment" as const,
        title: moment.title,
        detail: moment.description,
        timestamp: moment.occurredAt,
        importance: moment.importance,
        score: {
          away: moment.awayScore,
          home: moment.homeScore,
        },
        href: null,
      })),
    ...predictions.map((prediction) => ({
      id: `prediction:${prediction.id}`,
      kind: "prediction" as const,
      title: `${prediction.user.displayName} ${predictionLabel(prediction.selection)}`,
      detail:
        prediction.outcome === "CORRECT"
          ? "Correct"
          : prediction.outcome === "INCORRECT"
            ? "Incorrect"
            : prediction.status,
      timestamp: prediction.resolvedAt ?? prediction.submittedAt,
      importance: prediction.outcome === "CORRECT" ? 95 : 40,
      status: prediction.status,
      href: null,
    })),
  ].sort((left, right) => {
    const difference =
      new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime();
    if (difference !== 0) return difference;
    return right.importance - left.importance;
  });
}

export function GameMomentsPanel({
  gameId,
  phase,
  initialMoments,
  initialThreads,
  initialPredictions = [],
  initialActivity = [],
  sportKey,
}: {
  gameId: string;
  phase: GamePhase;
  initialMoments: Moment[];
  initialThreads: FlashThread[];
  initialPredictions?: LivePrediction[];
  initialActivity?: LiveFeedItem[];
  sportKey?: string;
}) {
  const [moments, setMoments] = useState(initialMoments);
  const [threads, setThreads] = useState(initialThreads);
  const [predictions, setPredictions] = useState(initialPredictions);
  const [activity, setActivity] = useState(
    initialActivity.length
      ? initialActivity
      : buildInitialActivity(initialMoments, initialThreads, initialPredictions),
  );
  const [updateState, setUpdateState] = useState<
    "current" | "checking" | "delayed"
  >("current");

  const refresh = useCallback(async () => {
    setUpdateState("checking");
    try {
      const response = await fetch(`/api/games/${gameId}/live-experience`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Live feed refresh failed.");
      const body = (await response.json()) as {
        data: {
          moments: Moment[];
          flashThreads: FlashThread[];
          predictions: LivePrediction[];
          activity: LiveFeedItem[];
        };
      };
      setMoments(body.data.moments);
      setThreads(body.data.flashThreads);
      setPredictions(body.data.predictions);
      setActivity(body.data.activity);
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
  const featuredThread = activity.find(
    (item) => item.kind === "thread" && item.featured,
  );
  const renderedActivity = useMemo(
    () => activity.filter((item) => item.id !== featuredThread?.id),
    [activity, featuredThread?.id],
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
            {archive ? "Permanent game archive" : "Live fan experience"}
          </p>
          <h2
            id="game-moments-title"
            className="font-display text-3xl font-black"
          >
            Live timeline
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {predictions.length ? (
            <Badge tone="live" className="gap-1.5">
              <span
                aria-hidden
                className="size-2 rounded-full bg-white motion-safe:animate-pulse"
              />
              {predictions.length} prediction
              {predictions.length === 1 ? "" : "s"}
            </Badge>
          ) : null}
          {threads.length ? <Badge tone="neutral">{threads.length} Flash Threads</Badge> : null}
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
              ? "Checking for updates"
              : updateState === "delayed"
                ? "Live updates delayed"
                : archive
                  ? "Archive current"
                  : "Live updates on"}
          </p>
        </div>
      </div>

      {featuredThread ? (
        renderFeedItem(featuredThread, sportKey, threads, archive, refresh, gameId)
      ) : null}

      {!featuredThread && !renderedActivity.length ? (
        <Card
          className="border-brand/25 relative grid min-h-48 place-items-center overflow-hidden rounded-2xl bg-[linear-gradient(135deg,var(--brand-surface),var(--surface-2))] px-5 py-10 text-center"
          data-featured-flash-thread
        >
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
                : "Major game moments and the conversation around them will appear here as the action unfolds."}
            </p>
          </div>
        </Card>
      ) : null}

      <Card className="border-border-strong bg-surface-1/65 rounded-2xl p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-text-muted text-xs font-bold tracking-[0.16em] uppercase">
              Unified live feed
            </p>
            <h3 className="font-display mt-1 text-2xl font-black">
              {archive ? "Game timeline" : "Moments, takes, predictions, and milestones"}
            </h3>
          </div>
          {renderedActivity.length ? (
            <span className="text-text-muted text-xs">
              {renderedActivity.length}{" "}
              {renderedActivity.length === 1 ? "item" : "items"}
            </span>
          ) : null}
        </div>

        {renderedActivity.length ? (
          <ol className="mt-6 grid gap-3" data-live-activity>
            {renderedActivity.map((item, index) => (
              <li key={item.id} className="relative" data-activity-kind={item.kind}>
                {renderedActivity[index + 1] ? (
                  <span
                    aria-hidden
                    className="from-border-subtle via-border-subtle to-transparent absolute top-10 bottom-[-0.875rem] left-5 w-px bg-gradient-to-b"
                  />
                ) : null}
                {renderFeedItem(item, sportKey, threads, archive, refresh, gameId)}
              </li>
            ))}
          </ol>
        ) : (
          <div className="px-5 py-10 text-center">
            <p className="font-bold">
              No one has started the conversation yet.
            </p>
            <p className="text-text-secondary mt-1 text-sm">
              Verified moments and real fan activity will appear here as the
              game unfolds.
            </p>
            {!archive ? (
              <div className="border-border-subtle bg-surface-2/60 mx-auto mt-5 max-w-2xl rounded-xl border p-3 text-left">
                <TakeComposer gameId={gameId} onPosted={refresh} />
              </div>
            ) : null}
          </div>
        )}
      </Card>

      <Card className="border-border-subtle bg-surface-1/70 rounded-2xl p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-text-muted text-xs font-bold tracking-[0.16em] uppercase">
              Verified play-by-play
            </p>
            <h3 className="font-display mt-1 text-2xl font-black">
              {archive ? "Moments archive" : "Recent moments"}
            </h3>
          </div>
          {moments.length ? (
            <span className="text-text-muted text-xs">
              {moments.length} {moments.length === 1 ? "moment" : "moments"}
            </span>
          ) : null}
        </div>
        {moments.length ? (
          <ol className="mt-6 grid gap-4" data-moments-timeline>
            {moments
              .slice()
              .sort((left, right) =>
                archive
                  ? new Date(left.occurredAt).getTime() -
                    new Date(right.occurredAt).getTime()
                  : new Date(right.occurredAt).getTime() -
                    new Date(left.occurredAt).getTime(),
              )
              .map((moment, index) => {
                const presentation = momentPresentation(moment, sportKey);
                const Icon = presentation.Icon;
                const major = moment.importance >= 70;
                return (
                  <li
                    key={moment.id}
                    className="relative grid grid-cols-[2.75rem_minmax(0,1fr)] gap-3 pb-5 last:pb-0 sm:grid-cols-[3rem_minmax(0,1fr)] sm:gap-4"
                    data-moment-type={moment.type}
                    data-moment-importance={major ? "major" : "standard"}
                  >
                    {index < moments.length - 1 ? (
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
                        {[moment.period, moment.clock].filter(Boolean).join(" · ") ||
                          "Game update"}
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

function renderFeedItem(
  item: LiveFeedItem,
  sportKey: string | undefined,
  threads: FlashThread[],
  archive: boolean,
  refresh: () => Promise<void>,
  gameId: string,
) {
  if (item.kind === "thread") {
    const thread = threads.find((candidate) => `thread:${candidate.id}` === item.id);
    if (!thread) return null;
    return (
      <Card
        className={cn(
          "border-brand/50 relative overflow-hidden rounded-2xl p-0 shadow-xl",
          item.featured
            ? "bg-[linear-gradient(135deg,var(--brand-surface),var(--surface-2)_58%,color-mix(in_srgb,var(--info)_10%,var(--surface-2)))]"
            : "bg-surface-1/80",
        )}
        data-featured-flash-thread={item.featured ? "" : undefined}
      >
        {item.featured ? (
          <div
            aria-hidden
            className="bg-brand/15 absolute -top-20 -right-16 size-52 rounded-full blur-3xl"
          />
        ) : null}
        <div className="border-border-subtle relative flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
          <Badge tone="live" className="gap-2 px-3 py-1.5 uppercase">
            <span
              aria-hidden
              className="size-2 rounded-full bg-white motion-safe:animate-pulse"
            />
            Flash Thread
          </Badge>
          <span className="text-text-secondary flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase">
            <MessageCircle aria-hidden className="text-brand size-3.5" />
            {thread.status}
          </span>
        </div>
        <div className="relative p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-text-muted text-xs font-bold tracking-[0.16em] uppercase">
                Fans are talking now
              </p>
              <h3 className="font-display mt-2 max-w-4xl text-2xl leading-tight font-black text-balance sm:text-4xl">
                {thread.title}
              </h3>
            </div>
            <MomentScore moment={thread.moment} />
          </div>
          <p className="text-text-secondary mt-3 flex flex-wrap items-center gap-2 text-sm">
            <Clock3 aria-hidden className="text-brand size-4" />
            {[thread.moment.period, thread.moment.clock]
              .filter(Boolean)
              .join(" · ") || "Verified game moment"}
          </p>
          <div className="mt-5 grid grid-cols-3 gap-2 sm:max-w-xl sm:gap-3">
            {[
              ["Takes", thread.takeCount],
              ["Reactions", thread.reactionCount],
              ["Replies", thread.replyCount],
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
          {thread.status === "ACTIVE" && !archive ? (
            <div className="border-brand/25 bg-surface-1/45 mt-6 rounded-xl border p-3 sm:p-4">
              <TakeComposer gameId={gameId} flashThreadId={thread.id} onPosted={refresh} />
            </div>
          ) : (
            <p className="border-border-subtle bg-surface-1/45 text-text-muted mt-6 rounded-xl border p-4 text-sm">
              This Flash Thread is preserved as a read-only game archive.
            </p>
          )}
          {thread.takes.length ? (
            <div className="mt-6 grid gap-4">
              {thread.takes.slice(0, 3).map((take) => (
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
                      thread.moment.period,
                      thread.title,
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
    );
  }

  const iconByKind: Record<LiveFeedItem["kind"], LucideIcon> = {
    moment: Radio,
    take: Flame,
    prediction: Sparkles,
    milestone: Zap,
    thread: MessageSquareText,
  };
  const toneByKind: Record<LiveFeedItem["kind"], string> = {
    moment: "bg-brand/10 text-brand",
    take: "bg-warning/10 text-warning",
    prediction: "bg-success/10 text-success",
    milestone: "bg-info/10 text-info",
    thread: "bg-brand-surface text-brand",
  };
  const Icon = iconByKind[item.kind];

  return (
    <article
      className="border-border-subtle bg-surface-1/75 hover:bg-surface-1/90 grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3 rounded-xl border p-4 transition motion-reduce:transition-none"
      data-live-activity-item
    >
      <span
        className={cn(
          "grid size-10 place-items-center rounded-xl",
          toneByKind[item.kind],
        )}
      >
        <Icon aria-hidden className="size-5" />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <strong className="text-sm">{item.title}</strong>
              {item.kind === "prediction" ? (
                <Badge tone="neutral" className="px-2 py-0.5 text-[0.65rem]">
                  {item.status ?? "OPEN"}
                </Badge>
              ) : null}
            </div>
            {item.detail ? (
              <p className="text-text-secondary mt-1 line-clamp-2 text-sm">
                {item.detail}
              </p>
            ) : null}
            {item.kind === "prediction" ? (
              <p className="text-text-muted mt-1 text-xs">
                {item.status === "RESOLVED"
                  ? "Resolved prediction"
                  : item.status === "LOCKED"
                    ? "Locked server-side"
                    : "Open prediction"}
              </p>
            ) : null}
          </div>
          <LocalDateTime
            value={item.timestamp}
            className="text-text-muted shrink-0 text-xs"
          />
        </div>
        {item.score ? (
          <p className="text-text-secondary mt-2 text-xs">
            Score context{" "}
            {item.score.away !== null && item.score.home !== null
              ? `${item.score.away}–${item.score.home}`
              : "unavailable"}
          </p>
        ) : null}
      </div>
    </article>
  );
}
