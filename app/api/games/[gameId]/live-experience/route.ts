import { NextResponse } from "next/server";
import { z } from "zod";

import { getGameLiveExperience } from "@/lib/games/live-experience";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ gameId: string }> },
) {
  const { gameId } = await context.params;
  if (!z.string().uuid().safeParse(gameId).success)
    return NextResponse.json({ error: "Invalid game." }, { status: 400 });
  const experience = await getGameLiveExperience(gameId);
  return experience
    ? NextResponse.json({ data: experience })
    : NextResponse.json({ error: "Game not found." }, { status: 404 });
}
