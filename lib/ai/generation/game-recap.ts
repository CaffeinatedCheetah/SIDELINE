import "server-only";

import {
  AiArtifactStatus,
  AiArtifactType,
  AiEntityType,
  Prisma,
} from "@prisma/client";

import { AiError } from "@/lib/ai/errors";
import { getAiConfig } from "@/lib/ai/config";
import { canonicalHash } from "@/lib/ai/hash";
import { logAiEvent } from "@/lib/ai/logging";
import { OpenAiProvider } from "@/lib/ai/provider";
import type { AiProvider } from "@/lib/ai/types";
import {
  GAME_RECAP_CONTEXT_VERSION,
  GAME_RECAP_PROMPT_VERSION,
  gameRecapInstructions,
} from "@/lib/ai/prompts/game-recap-v1";
import {
  POSTGAME_COMMUNITY_WINDOW_MS,
  retrieveGameRecapContext,
} from "@/lib/ai/retrieval/game-recap";
import {
  GAME_RECAP_SCHEMA_VERSION,
  gameRecapSchema,
} from "@/lib/ai/schemas/game-recap";
import { validateGroundedGameRecap } from "@/lib/ai/validation/game-recap";
import { db } from "@/lib/db/client";

type GenerateOptions = {
  force?: boolean;
  provider?: AiProvider;
};

function safeFailureMessage(error: unknown) {
  return error instanceof AiError
    ? error.message.slice(0, 300)
    : "Recap generation failed.";
}

async function enforceBudget() {
  const config = getAiConfig();
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const [count, cost] = await Promise.all([
    db.aiArtifact.count({
      where: {
        type: AiArtifactType.GAME_RECAP,
        generatedAt: { gte: start },
        status: AiArtifactStatus.READY,
      },
    }),
    db.aiArtifact.aggregate({
      where: { generatedAt: { gte: start } },
      _sum: { estimatedCost: true },
    }),
  ]);
  if (
    count >= config.dailyGenerationLimit ||
    Number(cost._sum.estimatedCost ?? 0) >= config.dailyBudgetUsd
  )
    throw new AiError(
      "BUDGET_EXHAUSTED",
      "The daily AI generation budget is exhausted.",
    );
}

export async function generateGameRecap(
  gameId: string,
  options: GenerateOptions = {},
) {
  const config = getAiConfig();
  if (!config.enabled || !config.gameRecapsEnabled)
    throw new AiError("AI_DISABLED", "AI recaps are disabled.");

  const context = await retrieveGameRecapContext(gameId);
  if (!context) throw new AiError("NOT_FOUND", "Game not found.");
  if (context.officialFacts.state !== "FINAL")
    throw new AiError("NOT_FINAL", "Only completed games can be recapped.");
  if (JSON.stringify(context).length / 4 > config.maxInputTokens)
    throw new AiError(
      "INSUFFICIENT_DATA",
      "The bounded recap context exceeds the configured input limit.",
    );
  const enoughEvidence =
    context.officialFacts.finalScore.away !== null &&
    context.officialFacts.finalScore.home !== null &&
    context.moments.length >= 2;

  const hashContext = {
    ...context,
    community:
      context.officialFacts.endedAt &&
      Date.now() >
        new Date(context.officialFacts.endedAt).getTime() +
          POSTGAME_COMMUNITY_WINDOW_MS
        ? {
            threads: context.community.threads.map((thread) => ({
              id: thread.id,
              title: thread.title,
              status: thread.status,
              createdAt: thread.createdAt,
            })),
            takes: [],
            debates: context.community.debates.map((debate) => ({
              id: debate.id,
              title: debate.title,
              prompt: debate.prompt,
              createdAt: debate.createdAt,
            })),
          }
        : context.community,
  };
  const contextHash = canonicalHash(hashContext);
  const identity = {
    type: AiArtifactType.GAME_RECAP,
    entityType: AiEntityType.GAME,
    entityId: gameId,
    contextHash,
  };

  const existing = await db.aiArtifact.findUnique({
    where: { type_entityType_entityId_contextHash: identity },
  });
  if (existing?.status === AiArtifactStatus.READY && !options.force) {
    await db.aiArtifact.update({
      where: { id: existing.id },
      data: { cacheHitCount: { increment: 1 } },
    });
    logAiEvent("cache_hit", { artifactId: existing.id, gameId });
    return existing;
  }
  if (existing?.status === AiArtifactStatus.GENERATING)
    throw new AiError("CONFLICT", "This recap is already generating.", true);

  const artifact = existing
    ? await db.aiArtifact.update({
        where: { id: existing.id },
        data: options.force
          ? {
              status: AiArtifactStatus.PENDING,
              content: Prisma.JsonNull,
              errorCode: null,
              errorMessage: null,
            }
          : {},
      })
    : await db.aiArtifact.create({
        data: {
          ...identity,
          schemaVersion: GAME_RECAP_SCHEMA_VERSION,
          promptVersion: GAME_RECAP_PROMPT_VERSION,
          contextVersion: GAME_RECAP_CONTEXT_VERSION,
          sourceManifest: context.sourceManifest,
        },
      });

  if (!enoughEvidence) {
    return db.aiArtifact.update({
      where: { id: artifact.id },
      data: {
        status: AiArtifactStatus.INSUFFICIENT_DATA,
        errorCode: "INSUFFICIENT_DATA",
        errorMessage: "Not enough verified moments are available for a recap.",
      },
    });
  }

  await enforceBudget();
  const claimed = await db.aiArtifact.updateMany({
    where: {
      id: artifact.id,
      status: {
        in: [
          AiArtifactStatus.PENDING,
          AiArtifactStatus.FAILED,
          AiArtifactStatus.STALE,
        ],
      },
    },
    data: {
      status: AiArtifactStatus.GENERATING,
      attemptCount: { increment: 1 },
    },
  });
  if (claimed.count !== 1)
    throw new AiError("CONFLICT", "This recap is already generating.", true);

  const provider =
    options.provider ?? new OpenAiProvider(config.apiKey!, config.timeoutMs);
  try {
    const result = await provider.generateStructured({
      task: "GAME_RECAP",
      schema: gameRecapSchema,
      schemaName: "sideline_game_recap_v1",
      instructions: gameRecapInstructions,
      context,
      model: config.summaryModel,
      idempotencyKey: artifact.id,
      maxOutputTokens: config.maxOutputTokens,
    });
    const parsed = gameRecapSchema.parse(result.data);
    const grounding = validateGroundedGameRecap(parsed, context);
    if (!grounding.valid)
      throw new AiError(
        "INVALID_OUTPUT",
        `Grounding checks failed: ${grounding.errors.join(", ")}`,
      );
    const ready = await db.aiArtifact.update({
      where: { id: artifact.id },
      data: {
        status: AiArtifactStatus.READY,
        model: result.model,
        content: parsed,
        contentHash: canonicalHash(parsed),
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        cachedTokens: result.usage.cachedTokens,
        latencyMs: result.latencyMs,
        providerRequestId: result.requestId,
        generatedAt: new Date(),
        expiresAt: context.officialFacts.endedAt
          ? new Date(
              new Date(context.officialFacts.endedAt).getTime() +
                POSTGAME_COMMUNITY_WINDOW_MS,
            )
          : null,
        errorCode: null,
        errorMessage: null,
      },
    });
    logAiEvent("generation_ready", {
      artifactId: ready.id,
      gameId,
      model: result.model,
      promptVersion: GAME_RECAP_PROMPT_VERSION,
      contextVersion: GAME_RECAP_CONTEXT_VERSION,
      latencyMs: result.latencyMs,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      providerRequestId: result.requestId,
    });
    return ready;
  } catch (error) {
    const code = error instanceof AiError ? error.code : "PROVIDER";
    await db.aiArtifact.update({
      where: { id: artifact.id },
      data: {
        status: AiArtifactStatus.FAILED,
        errorCode: code,
        errorMessage: safeFailureMessage(error),
      },
    });
    logAiEvent("generation_failed", { artifactId: artifact.id, gameId, code });
    throw error;
  }
}
