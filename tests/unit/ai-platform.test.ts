import { describe, expect, it } from "vitest";

import { classifyProviderError } from "@/lib/ai/errors";
import { canonicalHash } from "@/lib/ai/hash";
import {
  buildPromptComparison,
  buildPromptVersionHistory,
} from "@/lib/ai/prompt-history";
import { GAME_RECAP_PROMPT_VERSION } from "@/lib/ai/prompts/game-recap-v1";
import { gameRecapSchema } from "@/lib/ai/schemas/game-recap";
import { validateGroundedGameRecap } from "@/lib/ai/validation/game-recap";

const momentId = "00000000-0000-4000-8000-000000000001";
const recap = {
  schemaVersion: "1" as const,
  headline: "Visitors close out a one-run final",
  dek: "A late verified moment shaped the finish.",
  summary: "The Visitors defeated the Home Team 4–3.",
  keyMoments: [
    {
      momentId,
      label: "Decisive score",
      description: "The verified scoring moment changed the final margin.",
      importance: "high" as const,
    },
  ],
  fanConversation: { summary: null, themes: [] },
  caveats: [],
};

const context = {
  contextVersion: "1",
  generatedForGameId: "00000000-0000-4000-8000-000000000010",
  officialFacts: {
    gameId: "00000000-0000-4000-8000-000000000010",
    league: {
      key: "mlb",
      name: "MLB",
      abbreviation: "MLB",
      sport: { key: "baseball", name: "Baseball" },
    },
    scheduledAt: "2026-07-01T00:00:00.000Z",
    endedAt: "2026-07-01T03:00:00.000Z",
    state: "FINAL",
    finalScore: { away: 4, home: 3 },
    awayTeam: { id: "a", name: "Visitors", abbreviation: "VIS" },
    homeTeam: { id: "h", name: "Home Team", abbreviation: "HOM" },
    finalPhase: "Final",
    venue: null,
    broadcast: null,
  },
  moments: [{ id: momentId }],
  community: { threads: [], takes: [], debates: [] },
  sourceManifest: [],
  versions: { prompt: GAME_RECAP_PROMPT_VERSION, schema: "1", context: "1" },
} as never;

const artifacts = [
  {
    id: "artifact-a",
    entityId: "game-a",
    promptVersion: "game-recap-v1",
    status: "READY",
    generatedAt: new Date("2026-07-31T01:00:00Z"),
    updatedAt: new Date("2026-07-31T01:00:00Z"),
    model: "gpt-5.4-mini",
    inputTokens: 100,
    outputTokens: 80,
    cachedTokens: 20,
    latencyMs: 1200,
    errorCode: null,
    errorMessage: null,
    content: {
      headline: "Visitors close it out",
      dek: "A concise verified finish.",
      summary: "The Visitors beat the Home Team 4–3.",
      keyMoments: [
        {
          momentId,
          label: "Go-ahead score",
          description: "A verified scoring moment changed the game.",
          importance: "high",
        },
      ],
      fanConversation: { summary: null, themes: [] },
      caveats: ["One official stat feed lagged briefly."],
    },
    sourceManifest: [{ type: "GAME_MOMENT", id: momentId }],
  },
  {
    id: "artifact-b",
    entityId: "game-a",
    promptVersion: "game-recap-v2",
    status: "READY",
    generatedAt: new Date("2026-07-31T02:00:00Z"),
    updatedAt: new Date("2026-07-31T02:00:00Z"),
    model: "gpt-5.4",
    inputTokens: 140,
    outputTokens: 120,
    cachedTokens: 0,
    latencyMs: 900,
    errorCode: null,
    errorMessage: null,
    content: {
      headline: "Visitors survive the comeback",
      dek: "Prompt revision produced a tighter finish.",
      summary: "The Visitors held on for a 4–3 win.",
      keyMoments: [
        {
          momentId,
          label: "Go-ahead score",
          description: "A verified scoring moment changed the game.",
          importance: "high",
        },
      ],
      fanConversation: { summary: "Fans focused on the late defense.", themes: ["defense"] },
      caveats: [],
    },
    sourceManifest: [
      { type: "GAME_MOMENT", id: momentId },
      { type: "TAKE", id: "take-1" },
    ],
  },
] as const;

describe("AI platform foundations", () => {
  it("creates a stable canonical hash independent of object key order", () => {
    expect(canonicalHash({ b: 2, a: 1 })).toBe(canonicalHash({ a: 1, b: 2 }));
  });

  it("enforces the strict versioned recap schema", () => {
    expect(gameRecapSchema.parse(recap)).toEqual(recap);
    expect(() =>
      gameRecapSchema.parse({ ...recap, unsupported: "field" }),
    ).toThrow();
    expect(() =>
      gameRecapSchema.parse({ ...recap, headline: "<script>x</script>" }),
    ).toThrow();
  });

  it("rejects unknown source references and contradictory scores", () => {
    expect(validateGroundedGameRecap(recap, context).valid).toBe(true);
    const invalid = {
      ...recap,
      summary: "The final was 9–1.",
      keyMoments: [
        {
          ...recap.keyMoments[0],
          momentId: "00000000-0000-4000-8000-000000000099",
        },
      ],
    };
    const result = validateGroundedGameRecap(invalid, context);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("CONTRADICTORY_SCORE:9-1");
    expect(result.errors[0]).toContain("UNKNOWN_MOMENT");
  });

  it("does not permit fan summaries without community evidence", () => {
    const result = validateGroundedGameRecap(
      {
        ...recap,
        fanConversation: { summary: "Fans agreed.", themes: ["agreement"] },
      },
      context,
    );
    expect(result.errors).toContain("UNSUPPORTED_FAN_CONVERSATION");
  });

  it("retries only transient provider classes", () => {
    expect(classifyProviderError({ status: 429 }).retryable).toBe(true);
    expect(classifyProviderError({ status: 503 }).retryable).toBe(true);
    expect(classifyProviderError({ status: 401 }).retryable).toBe(false);
    expect(classifyProviderError({ status: 400 }).retryable).toBe(false);
  });

  it("groups prompt version history from stored artifacts", () => {
    const history = buildPromptVersionHistory([...artifacts]);
    expect(history).toEqual([
      expect.objectContaining({
        promptVersion: "game-recap-v2",
        count: 1,
        readyCount: 1,
        failedCount: 0,
        totalTokens: 260,
      }),
      expect.objectContaining({
        promptVersion: "game-recap-v1",
        count: 1,
        readyCount: 1,
        failedCount: 0,
        totalTokens: 200,
      }),
    ]);
  });

  it("builds a comparison view for prompt revisions", () => {
    const comparison = buildPromptComparison(
      artifacts[0] as never,
      artifacts[1] as never,
    );
    expect(comparison.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Headline",
          delta: "Changed",
        }),
        expect.objectContaining({
          label: "Summary",
          delta: "Changed",
        }),
        expect.objectContaining({
          label: "Grounding",
          delta: "Changed",
        }),
        expect.objectContaining({
          label: "Token count",
          delta: "+60",
        }),
        expect.objectContaining({
          label: "Latency",
          delta: "-300",
        }),
        expect.objectContaining({
          label: "Source refs",
          delta: "+1",
        }),
      ]),
    );
  });
});
