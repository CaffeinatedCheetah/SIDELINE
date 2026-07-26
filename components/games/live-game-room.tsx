"use client";
import { useEffect, useRef, useState } from "react";

type LiveGameState = {
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  period: string | null;
  clock: string | null;
};

export function LiveGameRoom({
  gameId,
  initialStatus,
  initialHomeScore,
  initialAwayScore,
  initialPeriod,
  initialClock,
}: {
  gameId: string;
  initialStatus: string;
  initialHomeScore: number | null;
  initialAwayScore: number | null;
  initialPeriod: string | null;
  initialClock: string | null;
}) {
  const [game, setGame] = useState<LiveGameState>({
    status: initialStatus,
    homeScore: initialHomeScore,
    awayScore: initialAwayScore,
    period: initialPeriod,
    clock: initialClock,
  });
  const [connection, setConnection] = useState<
    "connected" | "retrying" | "offline"
  >("connected");
  const latest = useRef(0);
  const statusRef = useRef(initialStatus);

  useEffect(() => {
    if (initialStatus !== "LIVE") return;
    const controller = new AbortController();
    const poll = async () => {
      if (statusRef.current !== "LIVE") return;
      const request = ++latest.current;
      try {
        const response = await fetch(`/api/v1/games/${gameId}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (request !== latest.current) return;
        if (response.ok) {
          const body = (await response.json()) as {
            data?: {
              status: string;
              homeScore: number | null;
              awayScore: number | null;
              period: string | null;
              clock: string | null;
            };
          };
          if (body.data) {
            statusRef.current = body.data.status;
            setGame({
              status: body.data.status,
              homeScore: body.data.homeScore,
              awayScore: body.data.awayScore,
              period: body.data.period,
              clock: body.data.clock,
            });
          }
          setConnection("connected");
        } else setConnection("retrying");
      } catch {
        if (!controller.signal.aborted)
          setConnection(navigator.onLine ? "retrying" : "offline");
      }
    };
    const timer = setInterval(poll, 15_000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [gameId, initialStatus]);

  if (initialStatus !== "LIVE") return null;

  return (
    <p role="status" className="text-text-secondary mb-4 text-sm">
      <strong className="text-text-primary font-display text-lg tabular-nums">
        {game.awayScore ?? 0}–{game.homeScore ?? 0}
      </strong>{" "}
      · {game.period ?? "Live"} {game.clock ?? ""} · {game.status} ·{" "}
      {connection}
    </p>
  );
}
