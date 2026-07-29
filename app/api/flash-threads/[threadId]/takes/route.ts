import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import {
  checkRateLimit,
  rateLimitKey,
  rateLimitPolicy,
} from "@/lib/api/rate-limit";
import { db } from "@/lib/db/client";
import { createTake, TakeCreationError } from "@/lib/takes/create-take";

const bodySchema = z.object({
  body: z.string().trim().min(1).max(1000),
  communityId: z.string().uuid().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ threadId: string }> },
) {
  const { threadId } = await context.params;
  if (!z.string().uuid().safeParse(threadId).success)
    return NextResponse.json(
      { error: "Invalid Flash Thread." },
      { status: 400 },
    );
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json(
      { error: { code: "AUTH_REQUIRED", message: "Sign in to continue." } },
      { status: 401 },
    );
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { status: true, bannedAt: true, mutedUntil: true },
  });
  if (
    !user ||
    user.status !== "ACTIVE" ||
    user.bannedAt ||
    (user.mutedUntil && user.mutedUntil > new Date())
  )
    return NextResponse.json(
      {
        error: { code: "ACCOUNT_RESTRICTED", message: "Posting unavailable." },
      },
      { status: 403 },
    );
  const limit = await checkRateLimit(
    rateLimitKey(request, "takes", session.user.id),
    rateLimitPolicy("takes"),
  );
  if (!limit.allowed)
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Please wait." } },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      },
    );
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "Invalid Take." } },
      { status: 400 },
    );
  try {
    const take = await createTake({
      authorId: session.user.id,
      flashThreadId: threadId,
      ...parsed.data,
    });
    return NextResponse.json({ data: take }, { status: 201 });
  } catch (error) {
    if (error instanceof TakeCreationError)
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        {
          status:
            error.code === "FORBIDDEN"
              ? 403
              : error.code === "NOT_FOUND"
                ? 404
                : 409,
        },
      );
    throw error;
  }
}
