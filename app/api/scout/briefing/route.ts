import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { generateDailyBriefing } from "@/lib/services/daily-briefing";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;

  const briefing = await generateDailyBriefing(userId || undefined);

  if (!briefing) {
    return NextResponse.json(
      { error: "Could not generate briefing" },
      { status: 503 },
    );
  }

  return NextResponse.json(briefing, {
    headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" },
  });
}
