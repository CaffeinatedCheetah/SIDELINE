import { z } from "zod";
import { NextResponse } from "next/server";
import { getGamePulse } from "@/lib/services/game-pulse";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  const { gameId } = await params;

  if (!z.string().uuid().safeParse(gameId).success) {
    return NextResponse.json({ error: "gameId required" }, { status: 400 });
  }

  const pulse = await getGamePulse(gameId);

  if (!pulse)
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  return NextResponse.json(pulse, {
    headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" },
  });
}
