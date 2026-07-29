import { NextResponse } from "next/server";
import { z } from "zod";

import { getGameMoments } from "@/lib/sports/moments/read-model";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ gameId: string }> },
) {
  const { gameId } = await context.params;
  if (!z.string().uuid().safeParse(gameId).success)
    return NextResponse.json({ error: "Invalid game." }, { status: 400 });
  const moments = await getGameMoments(gameId);
  return moments
    ? NextResponse.json({ data: moments })
    : NextResponse.json({ error: "Game not found." }, { status: 404 });
}
