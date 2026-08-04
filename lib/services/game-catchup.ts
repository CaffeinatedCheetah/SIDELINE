// SCOUT Game Catch-Up — "Catch me up" on any game
// Generates a structured summary from live ESPN data + user takes/threads.
// Returns: what happened, biggest moments, why fans are arguing,
// biggest surprise, and top take.

import { callClaude, parseJSON } from "@/lib/services/scout-content";
import { db } from "@/lib/db/client";

export type GameCatchUp = {
  whatHappened: string;
  biggestMoments: string[];
  whyFansAreArguing: string;
  biggestSurprise: string;
  topTake: { body: string; author: string } | null;
  generatedAt: string;
};

type GameContext = {
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  league: string;
  statusDetail: string;
  situation?: string;
};

export async function generateGameCatchUp(
  gameId: string,
  espnContext: GameContext,
): Promise<GameCatchUp | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  // Gather user-generated content about this game
  const since = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const [takes, topTake] = await Promise.all([
    db.take.findMany({
      where: { gameId, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { body: true },
    }),
    db.take.findFirst({
      where: { gameId, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 1,
      select: {
        body: true,
        author: { select: { handle: true, displayName: true } },
      },
    }),
  ]);

  const fanTakes = takes.map((t) => t.body).join("\n- ");

  const prompt = `You are SCOUT, FanTakes' AI sports companion. Generate a "Catch Me Up" summary for this game.

Game: ${espnContext.awayTeam} ${espnContext.awayScore ?? "?"} @ ${espnContext.homeTeam} ${espnContext.homeScore ?? "?"}
League: ${espnContext.league}
Status: ${espnContext.statusDetail}
${espnContext.situation ? `Current situation: ${espnContext.situation}` : ""}

${fanTakes ? `Fan takes from the community:\n- ${fanTakes}` : "No fan takes yet."}

Return JSON with these fields:
- whatHappened: 2-3 sentence summary of the game so far (under 200 chars)
- biggestMoments: array of 2-3 key moments (each under 80 chars)
- whyFansAreArguing: what the community is debating right now (under 150 chars)
- biggestSurprise: the most unexpected thing so far (under 100 chars)

Write like a knowledgeable fan briefing a friend, not a news anchor. Be specific about players and plays.
Return ONLY the JSON object.`;

  try {
    const text = await callClaude({ prompt, maxTokens: 600 });
    const parsed = parseJSON<Omit<GameCatchUp, "topTake" | "generatedAt">>(text);
    if (!parsed) return null;

    return {
      ...parsed,
      topTake: topTake
        ? {
            body: topTake.body,
            author: topTake.author?.displayName || topTake.author?.handle || "Anonymous",
          }
        : null,
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
