import "server-only";

import { z } from "zod";

const booleanValue = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const aiEnvironmentSchema = z.object({
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_AI_ENABLED: booleanValue,
  OPENAI_GAME_RECAPS_ENABLED: booleanValue,
  OPENAI_AI_ADMIN_GENERATION_ENABLED: booleanValue,
  OPENAI_SUMMARY_MODEL: z.string().min(1).default("gpt-5.4-mini"),
  OPENAI_COMPLEX_MODEL: z.string().min(1).default("gpt-5.4"),
  OPENAI_AI_DAILY_BUDGET_USD: z.coerce.number().positive().default(5),
  OPENAI_AI_DAILY_GENERATION_LIMIT: z.coerce
    .number()
    .int()
    .positive()
    .default(25),
  OPENAI_AI_MAX_INPUT_TOKENS: z.coerce.number().int().positive().default(12000),
  OPENAI_AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(1800),
  OPENAI_AI_TIMEOUT_MS: z.coerce.number().int().min(1000).default(30000),
});

export type AiConfig = ReturnType<typeof getAiConfig>;

export function getAiConfig() {
  const parsed = aiEnvironmentSchema.safeParse(process.env);
  if (!parsed.success) {
    return {
      enabled: false,
      gameRecapsEnabled: false,
      adminGenerationEnabled: false,
      apiKey: undefined,
      summaryModel: "gpt-5.4-mini",
      complexModel: "gpt-5.4",
      dailyBudgetUsd: 5,
      dailyGenerationLimit: 25,
      maxInputTokens: 12000,
      maxOutputTokens: 1800,
      timeoutMs: 30000,
      configurationError: parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; "),
    };
  }
  const value = parsed.data;
  return {
    enabled: value.OPENAI_AI_ENABLED && Boolean(value.OPENAI_API_KEY),
    gameRecapsEnabled: value.OPENAI_GAME_RECAPS_ENABLED,
    adminGenerationEnabled: value.OPENAI_AI_ADMIN_GENERATION_ENABLED,
    apiKey: value.OPENAI_API_KEY,
    summaryModel: value.OPENAI_SUMMARY_MODEL,
    complexModel: value.OPENAI_COMPLEX_MODEL,
    dailyBudgetUsd: value.OPENAI_AI_DAILY_BUDGET_USD,
    dailyGenerationLimit: value.OPENAI_AI_DAILY_GENERATION_LIMIT,
    maxInputTokens: value.OPENAI_AI_MAX_INPUT_TOKENS,
    maxOutputTokens: value.OPENAI_AI_MAX_OUTPUT_TOKENS,
    timeoutMs: value.OPENAI_AI_TIMEOUT_MS,
    configurationError: null,
  };
}
