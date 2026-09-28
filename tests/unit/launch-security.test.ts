import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn(async () => null) }));
vi.mock("@/lib/db/client", () => ({ db: {} }));
import { GET as scout } from "@/app/api/scout/route";
import { GET as briefing } from "@/app/api/scout/briefing/route";
import { budgetConfiguration } from "@/lib/ai/budget";

afterEach(() => vi.unstubAllEnvs());

describe("launch security boundaries", () => {
  it("rejects Scout with no secret before any database or AI work", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect(
      (await scout(new Request("https://example.test/api/scout"))).status,
    ).toBe(401);
  });
  it("rejects an incorrect Scout secret", async () => {
    vi.stubEnv("CRON_SECRET", "expected");
    expect(
      (
        await scout(
          new Request("https://example.test/api/scout", {
            headers: { authorization: "Bearer wrong" },
          }),
        )
      ).status,
    ).toBe(401);
  });
  it("does not generate anonymous personalized briefings", async () => {
    expect(
      (await briefing(new Request("https://example.test/api/scout/briefing")))
        .status,
    ).toBe(401);
  });
  it("fails closed without approved model pricing", () => {
    vi.stubEnv("OPENAI_AI_PRICED_MODEL", "");
    expect(() => budgetConfiguration("openai")).toThrow(/pricing/);
  });
  it("rejects invalid budget limits", () => {
    vi.stubEnv("OPENAI_AI_PRICED_MODEL", "test-model");
    vi.stubEnv("OPENAI_AI_INPUT_USD_PER_MILLION", "1");
    vi.stubEnv("OPENAI_AI_OUTPUT_USD_PER_MILLION", "2");
    vi.stubEnv("OPENAI_AI_DAILY_GENERATION_LIMIT", "0");
    expect(() => budgetConfiguration("openai")).toThrow();
  });
});
