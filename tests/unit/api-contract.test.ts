import { describe, expect, it } from "vitest";
import { z } from "zod";
import { apiError, cursorPage, parseJson } from "@/lib/api/http";
import { checkRateLimit } from "@/lib/api/rate-limit";

describe("API contract", () => {
  it("clamps cursor page size", () =>
    expect(cursorPage(new URLSearchParams("limit=500&cursor=abc"))).toEqual({
      limit: 50,
      cursor: "abc",
    }));
  it("returns the stable error envelope", async () =>
    expect(await apiError("INVALID", "No", 400).json()).toEqual({
      error: { code: "INVALID", message: "No" },
    }));
  it("validates JSON without coercing invalid values", async () => {
    const result = await parseJson(
      new Request("https://example.test", {
        method: "POST",
        body: JSON.stringify({ count: "1" }),
      }),
      z.object({ count: z.number() }),
    );
    expect(result.success).toBe(false);
  });
  it("enforces bounded in-process rate limits", () => {
    const key = `test-${crypto.randomUUID()}`;
    expect(checkRateLimit(key, { limit: 1, windowMs: 1000 }).allowed).toBe(
      true,
    );
    expect(checkRateLimit(key, { limit: 1, windowMs: 1000 }).allowed).toBe(
      false,
    );
  });
});
