import { describe, expect, it } from "vitest";
import { z } from "zod";
import { apiError, cursorPage, parseJson } from "@/lib/api/http";
import {
  checkRateLimit,
  rateLimitKey,
  rateLimitPolicy,
  type RateLimitStore,
} from "@/lib/api/rate-limit";

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
  it("reports malformed JSON as validation failure", async () => {
    const result = await parseJson(
      new Request("https://example.test", {
        method: "POST",
        body: "{not-json",
      }),
      z.object({ count: z.number() }),
    );
    expect(result.success).toBe(false);
  });
  it("enforces bounded limits through a shared-store contract", async () => {
    const key = `test-${crypto.randomUUID()}`;
    const counts = new Map<string, number>();
    const store: RateLimitStore = {
      consume: async (storeKey, options, now) => {
        const count = (counts.get(storeKey) ?? 0) + 1;
        counts.set(storeKey, count);
        return {
          count,
          resetsAt: new Date(now.getTime() + options.windowMs),
        };
      },
    };
    expect(
      (await checkRateLimit(key, { limit: 1, windowMs: 1000 }, store)).allowed,
    ).toBe(true);
    expect(
      (await checkRateLimit(key, { limit: 1, windowMs: 1000 }, store)).allowed,
    ).toBe(false);
  });

  it("creates privacy-preserving authenticated and anonymous keys", () => {
    const request = new Request("https://example.test", {
      headers: { "x-forwarded-for": "203.0.113.7" },
    });
    expect(rateLimitKey(request, "takes", "user-id")).toBe(
      "user:user-id:takes",
    );
    const anonymous = rateLimitKey(request, "takes");
    expect(anonymous).toMatch(/^anonymous:[a-f0-9]{64}:takes$/);
    expect(anonymous).not.toContain("203.0.113.7");
    expect(rateLimitPolicy("reports")).toEqual({
      limit: 10,
      windowMs: 3_600_000,
    });
  });

  it("includes response headers in the stable error envelope", async () => {
    const response = apiError("RATE_LIMITED", "Wait", 429, undefined, {
      "Retry-After": "12",
    });
    expect(response.headers.get("Retry-After")).toBe("12");
    expect(await response.json()).toEqual({
      error: { code: "RATE_LIMITED", message: "Wait" },
    });
  });
});
