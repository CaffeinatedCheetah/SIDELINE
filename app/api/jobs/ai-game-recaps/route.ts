import { NextResponse } from "next/server";

import { getAiConfig } from "@/lib/ai/config";
import { generateGameRecap } from "@/lib/ai/generation/game-recap";
import { db } from "@/lib/db/client";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const config = getAiConfig();
  if (!config.enabled || !config.gameRecapsEnabled)
    return NextResponse.json({ ok: true, disabled: true, results: [] });
  const games = await db.game.findMany({
    where: { status: "FINAL", moments: { some: {} } },
    orderBy: { endedAt: "desc" },
    take: 3,
    select: { id: true },
  });
  const results = [];
  for (const game of games) {
    try {
      const artifact = await generateGameRecap(game.id);
      results.push({ gameId: game.id, status: artifact.status });
    } catch (error) {
      results.push({
        gameId: game.id,
        status: "FAILED",
        code:
          error instanceof Error && "code" in error
            ? String(error.code)
            : "UNKNOWN",
      });
    }
  }
  return NextResponse.json({ ok: true, results });
}
