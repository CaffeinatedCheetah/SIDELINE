"use client";

import { Bell, BellOff, MapPin, Radio, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { LocalDateTime } from "@/components/ui/local-date-time";
import { Button, buttonStyles } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/foundations";
import {
  lifecycleRefreshIntervalMs,
  type GamePhase,
} from "@/lib/sports/game-lifecycle";
import type { CanonicalGame } from "@/lib/sports/game-domain";

type LiveGameState = Pick<
  CanonicalGame,
  | "phase"
  | "homeScore"
  | "awayScore"
  | "period"
  | "clock"
  | "detail"
  | "lastProviderUpdateAt"
  | "version"
>;

function phaseLabel(game: LiveGameState) {
  if (game.phase === "HALFTIME") return "Halftime";
  if (game.phase === "LIVE")
    return [game.period, game.clock].filter(Boolean).join(" · ") || "Live";
  if (game.phase === "PREGAME") return game.detail || "Pregame";
  return game.phase.charAt(0) + game.phase.slice(1).toLowerCase();
}

export function LiveGameRoom({
  gameId,
  startsAt,
  homeTeam,
  awayTeam,
  venue,
  broadcast,
  initialPhase,
  initialHomeScore,
  initialAwayScore,
  initialPeriod,
  initialClock,
  initialDetail,
  initialProviderUpdatedAt,
  initialVersion,
  initialFollowerCount,
  initialFollowing,
  signedIn,
}: {
  gameId: string;
  startsAt: string;
  homeTeam: string;
  awayTeam: string;
  venue: string | null;
  broadcast: string[];
  initialPhase: GamePhase;
  initialHomeScore: number | null;
  initialAwayScore: number | null;
  initialPeriod: string | null;
  initialClock: string | null;
  initialDetail: string | null;
  initialProviderUpdatedAt: string | null;
  initialVersion: number;
  initialFollowerCount: number;
  initialFollowing: boolean;
  signedIn: boolean;
}) {
  const [game, setGame] = useState<LiveGameState>({
    phase: initialPhase,
    homeScore: initialHomeScore,
    awayScore: initialAwayScore,
    period: initialPeriod,
    clock: initialClock,
    detail: initialDetail,
    lastProviderUpdateAt: initialProviderUpdatedAt,
    version: initialVersion,
  });
  const [following, setFollowing] = useState(initialFollowing);
  const [followerCount, setFollowerCount] = useState(initialFollowerCount);
  const [followPending, setFollowPending] = useState(false);
  const [activeUsers, setActiveUsers] = useState<number | null>(null);
  const [connection, setConnection] = useState<
    "current" | "refreshing" | "stale"
  >("current");
  const latest = useRef(0);

  useEffect(() => {
    let visitorId = window.sessionStorage.getItem("fantakes-room-visitor");
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      window.sessionStorage.setItem("fantakes-room-visitor", visitorId);
    }
    const controller = new AbortController();
    const heartbeat = async () => {
      try {
        const response = await fetch(`/api/games/${gameId}/presence`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ visitorId }),
          signal: controller.signal,
        });
        const data = (await response.json()) as {
          activeUsers: number | null;
        };
        setActiveUsers(data.activeUsers);
      } catch {
        if (!controller.signal.aborted) setActiveUsers(null);
      }
    };
    void heartbeat();
    const timer = window.setInterval(heartbeat, 45_000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [gameId]);

  useEffect(() => {
    const refreshInterval = lifecycleRefreshIntervalMs({
      phase: game.phase,
      startsAt,
    });
    if (!refreshInterval) return;
    const controller = new AbortController();
    const poll = async () => {
      const request = ++latest.current;
      setConnection("refreshing");
      try {
        const response = await fetch(`/api/v1/games/${gameId}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (request !== latest.current) return;
        if (!response.ok) {
          setConnection("stale");
          return;
        }
        const body = (await response.json()) as {
          data?: CanonicalGame & { following?: boolean };
        };
        if (body.data) {
          setGame({
            phase: body.data.phase,
            homeScore: body.data.homeScore,
            awayScore: body.data.awayScore,
            period: body.data.period,
            clock: body.data.clock,
            detail: body.data.detail,
            lastProviderUpdateAt: body.data.lastProviderUpdateAt,
            version: body.data.version,
          });
          setFollowerCount(body.data.followerCount);
          if (signedIn && typeof body.data.following === "boolean")
            setFollowing(body.data.following);
        }
        setConnection("current");
      } catch {
        if (!controller.signal.aborted) setConnection("stale");
      }
    };
    const timer = window.setInterval(poll, refreshInterval);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [game.phase, gameId, signedIn, startsAt]);

  async function toggleFollow() {
    if (!signedIn) return;
    setFollowPending(true);
    const next = !following;
    try {
      const response = await fetch("/api/v1/game-follows", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          gameId,
          follow: next,
          notifications: true,
        }),
      });
      if (response.ok) {
        setFollowing(next);
        setFollowerCount((count) => Math.max(0, count + (next ? 1 : -1)));
      }
    } finally {
      setFollowPending(false);
    }
  }

  const hasScore =
    game.homeScore !== null &&
    game.awayScore !== null &&
    game.phase !== "SCHEDULED" &&
    game.phase !== "PREGAME";
  const live = game.phase === "LIVE" || game.phase === "HALFTIME";

  return (
    <Card className="border-border-strong bg-surface-2 sticky top-16 z-20 mb-6 overflow-hidden p-0 shadow-lg">
      <div className="border-border-subtle flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
        <Badge tone={live ? "live" : "neutral"}>{phaseLabel(game)}</Badge>
        <div className="text-text-muted flex flex-wrap items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <Users aria-hidden className="size-3.5" />
            {activeUsers === null
              ? `${followerCount} ${followerCount === 1 ? "fan" : "fans"} following`
              : `${activeUsers} ${activeUsers === 1 ? "fan" : "fans"} active`}
          </span>
          <span aria-live="polite">
            {connection === "stale"
              ? "Updates delayed"
              : connection === "refreshing"
                ? "Checking score"
                : "Score current"}
          </span>
        </div>
      </div>
      <div className="grid gap-5 px-5 py-5 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <div className="font-display flex flex-wrap items-baseline gap-x-3 gap-y-1 text-2xl font-black sm:text-3xl">
            <span>{awayTeam}</span>
            <span className="tabular-nums">
              {hasScore ? `${game.awayScore}–${game.homeScore}` : "vs"}
            </span>
            <span>{homeTeam}</span>
          </div>
          <div className="text-text-secondary mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {!live && game.phase !== "FINAL" ? (
              <span>
                <LocalDateTime value={startsAt} calendar />
              </span>
            ) : null}
            {venue ? (
              <span className="flex items-center gap-1.5">
                <MapPin aria-hidden className="size-4" />
                {venue}
              </span>
            ) : null}
            {broadcast.length ? (
              <span className="flex items-center gap-1.5">
                <Radio aria-hidden className="size-4" />
                {broadcast.join(", ")}
              </span>
            ) : null}
          </div>
        </div>
        {signedIn ? (
          <Button
            variant={following ? "secondary" : "primary"}
            onClick={toggleFollow}
            disabled={followPending}
            aria-pressed={following}
          >
            {following ? <BellOff aria-hidden /> : <Bell aria-hidden />}
            {following ? "Unfollow game" : "Follow game"}
          </Button>
        ) : (
          <Link
            className={buttonStyles({ variant: "primary" })}
            href={`/auth/sign-in?callbackUrl=/games/${gameId}`}
          >
            <Bell aria-hidden />
            Follow game
          </Link>
        )}
      </div>
    </Card>
  );
}
