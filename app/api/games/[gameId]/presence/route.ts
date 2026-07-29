import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { heartbeatGamePresence } from "@/lib/games/presence";

const bodySchema = z.object({
  visitorId: z.string().uuid(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ gameId: string }> },
) {
  const { gameId } = await context.params;
  if (!z.string().uuid().safeParse(gameId).success)
    return NextResponse.json({ error: "Invalid game." }, { status: 400 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid presence heartbeat." },
      {
        status: 400,
      },
    );
  const game = await db.game.findUnique({
    where: { id: gameId },
    select: { id: true },
  });
  if (!game)
    return NextResponse.json({ error: "Game not found." }, { status: 404 });
  try {
    return NextResponse.json(
      await heartbeatGamePresence({
        gameId,
        visitorId: parsed.data.visitorId,
      }),
    );
  } catch {
    return NextResponse.json({ activeUsers: null, available: false });
  }
}
