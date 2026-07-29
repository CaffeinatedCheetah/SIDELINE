import { NextResponse } from "next/server";

import { synchronizeMlbLifecycle } from "@/lib/sports/lifecycle-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await synchronizeMlbLifecycle();
  return NextResponse.json({ ok: result.errors === 0, result });
}
