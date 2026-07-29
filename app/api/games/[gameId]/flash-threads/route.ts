import { NextResponse } from "next/server";
import { z } from "zod";

import { getGameFlashThreads } from "@/lib/sports/moments/read-model";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ gameId: string }> },
) {
  const { gameId } = await context.params;
  if (!z.string().uuid().safeParse(gameId).success)
    return NextResponse.json({ error: "Invalid game." }, { status: 400 });
  const threads = await getGameFlashThreads(gameId);
  return threads
    ? NextResponse.json({ data: threads })
    : NextResponse.json({ error: "Game not found." }, { status: 404 });
}
