import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";

import { classifyProviderError } from "@/lib/ai/errors";
import type { AiProvider } from "@/lib/ai/types";

export class OpenAiProvider implements AiProvider {
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    private readonly timeoutMs: number,
  ) {
    this.client = new OpenAI({ apiKey, maxRetries: 0, timeout: timeoutMs });
  }

  async generateStructured<TSchema extends z.ZodType>(input: {
    task: "GAME_RECAP";
    schema: TSchema;
    schemaName: string;
    instructions: string;
    context: unknown;
    model: string;
    idempotencyKey: string;
    maxOutputTokens: number;
    signal?: AbortSignal;
  }) {
    const started = Date.now();
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await this.client.responses.parse(
          {
            model: input.model,
            instructions: input.instructions,
            input: JSON.stringify({
              task: input.task,
              untrustedContext: input.context,
            }),
            text: {
              format: zodTextFormat(input.schema, input.schemaName),
            },
            max_output_tokens: input.maxOutputTokens,
            store: false,
          },
          {
            signal: input.signal,
            timeout: this.timeoutMs,
            headers: { "Idempotency-Key": input.idempotencyKey },
          },
        );
        if (!response.output_parsed)
          throw new Error("Provider returned no structured output.");
        return {
          data: response.output_parsed as z.infer<TSchema>,
          model: response.model,
          requestId: response._request_id ?? null,
          latencyMs: Date.now() - started,
          usage: {
            inputTokens: response.usage?.input_tokens ?? 0,
            outputTokens: response.usage?.output_tokens ?? 0,
            cachedTokens:
              response.usage?.input_tokens_details?.cached_tokens ?? 0,
          },
        };
      } catch (error) {
        const classified = classifyProviderError(error);
        lastError = classified;
        if (!classified.retryable || attempt === 1) throw classified;
      }
    }
    throw classifyProviderError(lastError);
  }
}
