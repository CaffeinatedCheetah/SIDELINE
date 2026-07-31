import type { z } from "zod";

export type AiTask = "GAME_RECAP";

export type AiProviderUsage = {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
};

export type AiProviderResult<T> = {
  data: T;
  model: string;
  requestId: string | null;
  latencyMs: number;
  usage: AiProviderUsage;
};

export interface AiProvider {
  generateStructured<TSchema extends z.ZodType>(input: {
    task: AiTask;
    schema: TSchema;
    schemaName: string;
    instructions: string;
    context: unknown;
    model: string;
    idempotencyKey: string;
    maxOutputTokens: number;
    signal?: AbortSignal;
  }): Promise<AiProviderResult<z.infer<TSchema>>>;
}
