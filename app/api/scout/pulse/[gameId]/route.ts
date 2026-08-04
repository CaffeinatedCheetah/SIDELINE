import { NextResponse } from "next/server";
import { getGamePulse } from "@/lib/services/game-pulse";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  const { gameId } = await params;

  if (!gameId) {
    return NextResponse.json({ error: "gameId required" }, { status: 400 });
  }

  const pulse = await getGamePulse(gameId);

  return NextResponse.json(pulse, {
    headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" },
  });
}
