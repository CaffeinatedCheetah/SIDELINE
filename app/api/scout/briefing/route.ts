import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { withJobLease } from "@/lib/jobs/lease";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { generateDailyBriefing } from "@/lib/services/daily-briefing";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const quota = await checkRateLimit(
    rateLimitKey(request, "briefing", userId),
    { limit: 4, windowMs: 3_600_000 },
  );
  if (!quota.allowed)
    return NextResponse.json({ error: "Try again later" }, { status: 429 });
  const briefing = await withJobLease(`briefing:${userId}`, () =>
    generateDailyBriefing(userId),
  );

  if (!briefing) {
    return NextResponse.json(
      { error: "Could not generate briefing" },
      { status: 503 },
    );
  }

  return NextResponse.json(briefing, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
