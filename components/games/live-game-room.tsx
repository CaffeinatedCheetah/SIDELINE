"use client";

import type { CSSProperties } from "react";
import {
  Bell,
  BellOff,
  CalendarDays,
  MapPin,
  Radio,
  RefreshCw,
  Users,
} from "lucide-react";
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
import { cn } from "@/lib/utils";

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

type TeamPresentation = {
  name: string;
  abbreviation: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
};

const FALLBACK_TEAM_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#0891b2",
  "#c2410c",
  "#be123c",
  "#047857",
  "#a21caf",
  "#4338ca",
];

function phaseLabel(game: LiveGameState) {
  if (game.phase === "HALFTIME") return "Halftime";
  if (game.phase === "LIVE")
    return [game.period, game.clock].filter(Boolean).join(" · ") || "Live";
  if (game.phase === "PREGAME") return game.detail || "Pregame";
  if (game.phase === "CANCELLED") return "Cancelled";
  return game.phase.charAt(0) + game.phase.slice(1).toLowerCase();
}

function phaseTone(phase: GamePhase) {
  if (phase === "LIVE" || phase === "HALFTIME") return "live" as const;
  if (phase === "FINAL") return "success" as const;
  if (phase === "POSTPONED") return "warning" as const;
  if (phase === "CANCELLED") return "danger" as const;
  return "neutral" as const;
}

function fallbackColor(value: string) {
  const hash = [...value].reduce(
    (total, character) => (total * 31 + character.charCodeAt(0)) >>> 0,
    0,
  );
  return FALLBACK_TEAM_COLORS[hash % FALLBACK_TEAM_COLORS.length];
}

function safeTeamColor(value: string | null | undefined, fallbackKey: string) {
  if (!value) return fallbackColor(fallbackKey);
  const normalized = value.startsWith("#") ? value : `#${value}`;
  return /^#[\da-f]{6}$/i.test(normalized)
    ? normalized
    : fallbackColor(fallbackKey);
}

function gameTheme(
  homeTeam: TeamPresentation,
  awayTeam: TeamPresentation,
): CSSProperties {
  const home = safeTeamColor(
    homeTeam.primaryColor,
    homeTeam.abbreviation || homeTeam.name,
  );
  const away = safeTeamColor(
    awayTeam.primaryColor,
    awayTeam.abbreviation || awayTeam.name,
  );
  return {
    "--game-home": home,
    "--game-away": away,
    "--game-home-soft": `color-mix(in srgb, ${home} 18%, var(--surface-2))`,
    "--game-away-soft": `color-mix(in srgb, ${away} 18%, var(--surface-2))`,
  } as CSSProperties;
}

function TeamBlock({
  team,
  side,
}: {
  team: TeamPresentation;
  side: "away" | "home";
}) {
  const initials =
    team.abbreviation ||
    team.name
      .split(/\s+/)
      .map((word) => word[0])
      .join("")
      .slice(0, 3);
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col items-center gap-2 text-center sm:gap-3",
        side === "away"
          ? "sm:items-end sm:text-right"
          : "sm:items-start sm:text-left",
      )}
      data-team-side={side}
    >
      <span
        className={cn(
          "bg-surface-1/75 grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl border shadow-lg sm:size-16",
          side === "away"
            ? "border-[color:var(--game-away)]"
            : "border-[color:var(--game-home)]",
        )}
      >
        {team.logoUrl ? (
          // Provider logos have multiple trusted HTTPS hosts.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={team.logoUrl}
            alt={`${team.name} logo`}
            className="size-10 object-contain sm:size-14"
          />
        ) : (
          <span className="font-display text-base font-black tracking-wide sm:text-xl">
            {initials}
          </span>
        )}
      </span>
      <div className="min-w-0">
        <p className="text-text-muted text-[0.65rem] font-bold tracking-[0.2em] uppercase">
          {side}
        </p>
        <p className="font-display max-w-36 text-base leading-tight font-black text-balance sm:max-w-52 sm:text-2xl">
          {team.name}
        </p>
      </div>
    </div>
  );
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
  homeTeam: TeamPresentation;
  awayTeam: TeamPresentation;
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
  const connectionLabel =
    connection === "stale"
      ? "Updates delayed"
      : connection === "refreshing"
        ? "Checking score"
        : "Score current";

  return (
    <Card
      className="game-room-shell border-border-strong relative z-20 mb-7 overflow-hidden rounded-2xl p-0 shadow-2xl md:sticky md:top-16 md:p-0"
      data-game-room-shell
      data-game-phase={game.phase}
      style={gameTheme(homeTeam, awayTeam)}
    >
      <div aria-hidden className="game-room-glow game-room-glow-away" />
      <div aria-hidden className="game-room-glow game-room-glow-home" />
      <div className="relative">
        <div className="border-border-subtle flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              tone={phaseTone(game.phase)}
              className="gap-2 px-3 py-1.5 uppercase"
            >
              {live ? (
                <span
                  aria-hidden
                  className="size-2 rounded-full bg-white motion-safe:animate-pulse"
                />
              ) : null}
              {game.phase === "LIVE"
                ? `Live · ${phaseLabel(game)}`
                : phaseLabel(game)}
            </Badge>
            <span className="text-text-secondary flex items-center gap-1.5 text-xs font-semibold">
              <Users aria-hidden className="size-3.5" />
              {activeUsers === null
                ? `${followerCount} ${followerCount === 1 ? "fan" : "fans"} following`
                : `${activeUsers} ${activeUsers === 1 ? "fan" : "fans"} active`}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
            <span
              aria-live="polite"
              className={cn(
                "flex items-center gap-1.5 text-xs font-semibold",
                connection === "stale" ? "text-warning" : "text-text-muted",
              )}
            >
              <RefreshCw
                aria-hidden
                className={cn(
                  "size-3.5",
                  connection === "refreshing" && "motion-safe:animate-spin",
                )}
              />
              {connectionLabel}
            </span>
            {signedIn ? (
              <Button
                variant={following ? "secondary" : "primary"}
                size="sm"
                onClick={toggleFollow}
                disabled={followPending}
                aria-pressed={following}
                className="shrink-0"
              >
                {following ? <BellOff aria-hidden /> : <Bell aria-hidden />}
                {following ? "Unfollow game" : "Follow game"}
              </Button>
            ) : (
              <Link
                className={cn(
                  buttonStyles({ variant: "primary", size: "sm" }),
                  "shrink-0",
                )}
                href={`/auth/sign-in?callbackUrl=/games/${gameId}`}
              >
                <Bell aria-hidden />
                Follow game
              </Link>
            )}
          </div>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3 py-6 sm:gap-6 sm:px-8 sm:py-8">
          <TeamBlock team={awayTeam} side="away" />
          <div className="min-w-20 text-center sm:min-w-36">
            <p className="text-text-muted mb-1 text-[0.65rem] font-bold tracking-[0.2em] uppercase">
              {hasScore ? "Score" : "Matchup"}
            </p>
            <p
              aria-label={
                hasScore
                  ? `${awayTeam.name} ${game.awayScore}, ${homeTeam.name} ${game.homeScore}`
                  : `${awayTeam.name} versus ${homeTeam.name}`
              }
              className="font-display text-4xl leading-none font-black tracking-tight tabular-nums sm:text-6xl lg:text-7xl"
              data-game-score
            >
              {hasScore ? `${game.awayScore}–${game.homeScore}` : "vs"}
            </p>
            {game.detail && live ? (
              <p className="text-text-secondary mt-2 max-w-40 text-xs text-balance">
                {game.detail}
              </p>
            ) : null}
          </div>
          <TeamBlock team={homeTeam} side="home" />
        </div>

        <div className="border-border-subtle bg-surface-1/45 flex flex-col gap-2 border-t px-4 py-3 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-6 sm:px-6">
          {!live && game.phase !== "FINAL" ? (
            <span className="text-text-secondary flex items-center gap-2">
              <CalendarDays aria-hidden className="text-brand size-4" />
              <LocalDateTime value={startsAt} calendar />
            </span>
          ) : null}
          {venue ? (
            <span className="text-text-secondary flex items-center gap-2">
              <MapPin aria-hidden className="text-brand size-4" />
              {venue}
            </span>
          ) : null}
          {broadcast.length ? (
            <span className="text-text-secondary flex items-center gap-2">
              <Radio aria-hidden className="text-brand size-4" />
              {broadcast.join(", ")}
            </span>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
