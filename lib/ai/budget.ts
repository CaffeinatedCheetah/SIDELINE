import { db } from "@/lib/db/client";
import { AiError } from "@/lib/ai/errors";

export function budgetConfiguration(provider: "openai" | "anthropic") {
  const prefix = provider === "openai" ? "OPENAI_AI" : "SCOUT_AI";
  const budget = Number(process.env[prefix + "_DAILY_BUDGET_USD"] ?? 5);
  const limit = Number(process.env[prefix + "_DAILY_GENERATION_LIMIT"] ?? 25);
  const inputRate = Number(process.env[prefix + "_INPUT_USD_PER_MILLION"]);
  const outputRate = Number(process.env[prefix + "_OUTPUT_USD_PER_MILLION"]);
  const pricedModel = process.env[prefix + "_PRICED_MODEL"];
  if (
    ![budget, limit, inputRate, outputRate].every(
      (n) => Number.isFinite(n) && n > 0,
    ) ||
    !Number.isInteger(limit) ||
    !pricedModel
  )
    throw new AiError(
      "AI_DISABLED",
      "Configure model-specific AI pricing and limits before enabling generation.",
    );
  return { budget, limit, inputRate, outputRate, pricedModel };
}

export async function reserveAiRequest(
  provider: "openai" | "anthropic",
  model: string,
  input: string,
  maxOutputTokens: number,
) {
  const config = budgetConfiguration(provider);
  if (model !== config.pricedModel)
    throw new AiError(
      "AI_DISABLED",
      "This model has no approved pricing configuration.",
    );
  // UTF-8 bytes plus protocol overhead conservatively bound text tokens.
  const inputCeiling = Buffer.byteLength(input, "utf8") + 2048;
  const reserved =
    Math.ceil(
      inputCeiling * config.inputRate + maxOutputTokens * config.outputRate,
    ) / 1_000_000;
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${"ai-budget:" + provider}))`;
    const used = await tx.aiUsage.aggregate({
      where: { provider, createdAt: { gte: day } },
      _sum: { reservedUsd: true },
      _count: true,
    });
    if (
      used._count >= config.limit ||
      Number(used._sum.reservedUsd ?? 0) + reserved > config.budget
    )
      throw new AiError(
        "BUDGET_EXHAUSTED",
        "The daily AI budget is exhausted.",
      );
    return tx.aiUsage.create({
      data: { provider, model, reservedUsd: reserved },
    });
  });
}

export async function completeAiRequest(
  id: string,
  inputTokens: number,
  outputTokens: number,
) {
  // Reservations remain charged for the day, including unknown-cost failures.
  return db.aiUsage.update({
    where: { id },
    data: { status: "SUCCEEDED", inputTokens, outputTokens },
  });
}
