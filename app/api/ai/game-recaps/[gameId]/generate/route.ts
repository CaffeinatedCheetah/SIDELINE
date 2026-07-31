import { z } from "zod";

import { auth } from "@/auth";
import { apiError, apiSuccess, parseJson } from "@/lib/api/http";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { getAiConfig } from "@/lib/ai/config";
import { AiError } from "@/lib/ai/errors";
import { generateGameRecap } from "@/lib/ai/generation/game-recap";
import { db } from "@/lib/db/client";

const bodySchema = z.object({ force: z.boolean().default(false) }).strict();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id)
    return apiError("UNAUTHORIZED", "Sign in is required.", 401);
  const operator = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (operator?.role !== "ADMIN")
    return apiError("FORBIDDEN", "Administrator access is required.", 403);
  const config = getAiConfig();
  if (!config.adminGenerationEnabled)
    return apiError("AI_DISABLED", "Admin generation is disabled.", 503);
  const parsed = await parseJson(request, bodySchema);
  if (!parsed.success)
    return apiError("INVALID_REQUEST", "Invalid generation request.", 400);
  const rate = await checkRateLimit(
    rateLimitKey(request, "ai-game-recap", session.user.id),
    { limit: 5, windowMs: 60 * 60_000 },
  );
  if (!rate.allowed)
    return apiError("RATE_LIMITED", "Try again later.", 429, undefined, {
      "Retry-After": String(rate.retryAfterSeconds),
    });
  try {
    const { gameId } = await params;
    const artifact = await generateGameRecap(gameId, {
      force: parsed.data.force,
    });
    return apiSuccess({
      id: artifact.id,
      status: artifact.status,
      cached: artifact.cacheHitCount > 0,
    });
  } catch (error) {
    if (error instanceof AiError) {
      const status =
        error.code === "NOT_FOUND"
          ? 404
          : error.code === "NOT_FINAL"
            ? 409
            : error.code === "CONFLICT"
              ? 409
              : error.code === "BUDGET_EXHAUSTED"
                ? 429
                : 503;
      return apiError(error.code, error.message, status);
    }
    return apiError("AI_FAILED", "The recap could not be generated.", 503);
  }
}
