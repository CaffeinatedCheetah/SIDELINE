import { AiFeedbackReason, AiFeedbackValue } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/auth";
import { apiError, apiSuccess, parseJson } from "@/lib/api/http";
import { db } from "@/lib/db/client";

const bodySchema = z
  .object({
    value: z.nativeEnum(AiFeedbackValue),
    reason: z.nativeEnum(AiFeedbackReason).nullable().optional(),
  })
  .strict();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ artifactId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id)
    return apiError("UNAUTHORIZED", "Sign in is required.", 401);
  const parsed = await parseJson(request, bodySchema);
  if (!parsed.success)
    return apiError("INVALID_REQUEST", "Invalid feedback.", 400);
  const { artifactId } = await params;
  const artifact = await db.aiArtifact.findUnique({
    where: { id: artifactId },
    select: { id: true, status: true },
  });
  if (!artifact || artifact.status !== "READY")
    return apiError("NOT_FOUND", "Recap not found.", 404);
  const feedback = await db.aiArtifactFeedback.upsert({
    where: {
      artifactId_userId: { artifactId, userId: session.user.id },
    },
    create: {
      artifactId,
      userId: session.user.id,
      value: parsed.data.value,
      reason: parsed.data.reason,
    },
    update: {
      value: parsed.data.value,
      reason: parsed.data.reason,
    },
    select: { value: true, reason: true },
  });
  return apiSuccess(feedback);
}
