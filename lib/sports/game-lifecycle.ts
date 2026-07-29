import type { GameStatus } from "@prisma/client";

import type { ContestState } from "@/lib/sports/types";

export type GamePhase =
  | "SCHEDULED"
  | "PREGAME"
  | "LIVE"
  | "HALFTIME"
  | "FINAL"
  | "POSTPONED"
  | "CANCELLED";

export function phaseFromProviderState(state: ContestState): GamePhase {
  if (state === "pregame" || state === "delayed") return "PREGAME";
  if (state === "in_progress" || state === "suspended") return "LIVE";
  if (state === "halftime") return "HALFTIME";
  if (state === "final") return "FINAL";
  if (state === "postponed") return "POSTPONED";
  if (state === "cancelled") return "CANCELLED";
  return "SCHEDULED";
}

export function gameStatusFromProviderState(state: ContestState): GameStatus {
  return phaseFromProviderState(state);
}

export function lifecycleRefreshIntervalMs(
  game: { phase: GamePhase; startsAt: string },
  now = new Date(),
) {
  if (game.phase === "LIVE" || game.phase === "HALFTIME") return 20_000;
  if (game.phase === "FINAL") return 120_000;
  if (game.phase === "POSTPONED" || game.phase === "CANCELLED") return null;
  const untilStart = new Date(game.startsAt).getTime() - now.getTime();
  if (untilStart <= 6 * 60 * 60_000) return 5 * 60_000;
  return 15 * 60_000;
}
