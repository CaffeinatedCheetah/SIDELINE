// SCOUT Game Pulse — real-time "heartbeat" for every Game Room
// Combines ESPN live data + user activity (takes, threads, predictions)
// into a single at-a-glance panel showing momentum, crowd sentiment,
// and SCOUT's AI commentary on the game.

import { callClaude } from "@/lib/services/scout-content";
import { db } from "@/lib/db/client";

export type GamePulse = {
  momentum: { leader: string; percent: number } | null;
  crowdConfidence: { team: string; percent: number }[];
  fansActive: number;
  flashThreads: number;
  topPrediction: string | null;
  scoutCommentary: string | null;
  lastUpdated: string;
};

type ESPNGame = {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: string;
  statusDetail: string;
  situation?: string;
  recentPlays?: string[];
};

async function getGameActivity(gameId: string) {
  const since = new Date(Date.now() - 4 * 60 * 60 * 1000); // last 4 hours

  const [takes, predictions, recentTakes] = await Promise.all([
    db.take.count({
      where: { gameId, createdAt: { gte: since } },
    }),
    db.prediction.findMany({
      where: { gameId },
      select: { selection: true },
    }),
    db.take.findMany({
      where: { gameId, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { body: true },
    }),
  ]);

  // Count predictions per selection
  const predictionCounts: Record<string, number> = {};
  for (const p of predictions) {
    predictionCounts[p.selection] = (predictionCounts[p.selection] || 0) + 1;
  }
  const topPrediction = Object.entries(predictionCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || null;

  return {
    fansActive: takes,
    flashThreads: Math.floor(takes / 5), // approximate thread grouping
    topPrediction,
    recentTakeBodies: recentTakes.map((t) => t.body),
    totalPredictions: predictions.length,
    predictionCounts,
  };
}

function calculateMomentum(
  espn: ESPNGame | null,
): GamePulse["momentum"] {
  if (!espn || espn.status !== "in") return null;
  const total = (espn.homeScore || 0) + (espn.awayScore || 0);
  if (total === 0) return null;
  const homePercent = Math.round(((espn.homeScore || 0) / total) * 100);
  const awayPercent = 100 - homePercent;
  if (homePercent >= awayPercent) {
    return { leader: espn.homeTeam, percent: homePercent };
  }
  return { leader: espn.awayTeam, percent: awayPercent };
}

function calculateCrowdConfidence(
  espn: ESPNGame | null,
  predictionCounts: Record<string, number>,
  totalPredictions: number,
): GamePulse["crowdConfidence"] {
  if (!espn) return [];
  if (totalPredictions === 0) {
    return [
      { team: espn.homeTeam, percent: 50 },
      { team: espn.awayTeam, percent: 50 },
    ];
  }
  const homeVotes = predictionCounts[espn.homeTeam] || 0;
  const awayVotes = predictionCounts[espn.awayTeam] || 0;
  const total = homeVotes + awayVotes || 1;
  return [
    { team: espn.homeTeam, percent: Math.round((homeVotes / total) * 100) },
    { team: espn.awayTeam, percent: Math.round((awayVotes / total) * 100) },
  ];
}

async function generateScoutCommentary(
  espn: ESPNGame | null,
  recentTakes: string[],
): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!espn || espn.status !== "in") return null;

  const prompt = `You are SCOUT, the AI sports companion for FanTakes. Generate ONE sentence of live game commentary (under 120 chars) based on this:

Game: ${espn.awayTeam} ${espn.awayScore} @ ${espn.homeTeam} ${espn.homeScore}
Status: ${espn.statusDetail}
${espn.situation ? `Situation: ${espn.situation}` : ""}

Fan reactions:
${recentTakes.slice(0, 5).map((t) => `- "${t}"`).join("\n")}

Write like a smart fan watching live, not a broadcaster. One punchy observation. No quotes. Return ONLY the sentence, nothing else.`;

  try {
    const text = await callClaude({ prompt, maxTokens: 100 });
    return text?.trim().slice(0, 140) || null;
  } catch {
    return null;
  }
}

export async function getGamePulse(
  gameId: string,
  espnData?: ESPNGame | null,
): Promise<GamePulse> {
  const activity = await getGameActivity(gameId);
  const momentum = calculateMomentum(espnData ?? null);
  const crowdConfidence = calculateCrowdConfidence(
    espnData ?? null,
    activity.predictionCounts,
    activity.totalPredictions,
  );
  const scoutCommentary = await generateScoutCommentary(
    espnData ?? null,
    activity.recentTakeBodies,
  );

  return {
    momentum,
    crowdConfidence,
    fansActive: activity.fansActive,
    flashThreads: activity.flashThreads,
    topPrediction: activity.topPrediction,
    scoutCommentary,
    lastUpdated: new Date().toISOString(),
  };
}
