import { HallPeriod } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db/client";
import { runHallOfFlameJob } from "@/lib/services/hall-of-flame-job";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const results = [];
  for (const period of Object.values(HallPeriod)) {
    results.push({ period, ...(await runHallOfFlameJob(db, period)) });
  }
  return NextResponse.json({ ok: true, results });
}
