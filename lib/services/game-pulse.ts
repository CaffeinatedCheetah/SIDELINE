import { db } from "@/lib/db/client";
import { readGamePresence } from "@/lib/games/presence";

export type GamePulse = {
  momentum: { leader: string; percent: number } | null;
  crowdConfidence: { team: string; percent: number }[];
  fansActive: number | null;
  flashThreads: number;
  topPrediction: string | null;
  scoutCommentary: string | null;
  lastUpdated: string;
};

export async function getGamePulse(gameId: string): Promise<GamePulse | null> {
  const game = await db.game.findUnique({
    where: { id: gameId },
    include: { homeTeam: true, awayTeam: true },
  });
  if (!game) return null;
  const [votes, flashThreads, fansActive] = await Promise.all([
    db.prediction.groupBy({
      by: ["selection"],
      where: {
        gameId,
        locksAt: { lte: new Date() },
        user: { status: "ACTIVE" },
      },
      _count: true,
    }),
    db.flashThread.count({ where: { gameId, status: "ACTIVE" } }),
    readGamePresence(gameId),
  ]);
  const home = votes.find((v) => v.selection === "home")?._count ?? 0;
  const away = votes.find((v) => v.selection === "away")?._count ?? 0;
  const total = home + away;
  const percent = total ? Math.round((home / total) * 100) : 0;
  return {
    momentum: null,
    crowdConfidence: total
      ? [
          { team: game.homeTeam.name, percent },
          { team: game.awayTeam.name, percent: 100 - percent },
        ]
      : [],
    fansActive,
    flashThreads,
    topPrediction:
      total && home !== away
        ? home > away
          ? game.homeTeam.name
          : game.awayTeam.name
        : null,
    scoutCommentary: null,
    lastUpdated: new Date().toISOString(),
  };
}
