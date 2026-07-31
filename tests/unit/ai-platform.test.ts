import { describe, expect, it } from "vitest";

import { classifyProviderError } from "@/lib/ai/errors";
import { canonicalHash } from "@/lib/ai/hash";
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
});
