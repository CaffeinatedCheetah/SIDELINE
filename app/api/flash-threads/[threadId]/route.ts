import { NextResponse } from "next/server";
import { z } from "zod";

import { getFlashThread } from "@/lib/sports/moments/read-model";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ threadId: string }> },
) {
  const { threadId } = await context.params;
  if (!z.string().uuid().safeParse(threadId).success)
    return NextResponse.json(
      { error: "Invalid Flash Thread." },
      { status: 400 },
    );
  const thread = await getFlashThread(threadId);
  return thread
    ? NextResponse.json({ data: thread })
    : NextResponse.json({ error: "Flash Thread not found." }, { status: 404 });
}
