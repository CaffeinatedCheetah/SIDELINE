import { createHash } from "node:crypto";

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db/client";

export type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export type RateLimitStore = {
  consume(
    key: string,
    options: RateLimitOptions,
    now: Date,
  ): Promise<{ count: number; resetsAt: Date }>;
};

const databaseRateLimitStore: RateLimitStore = {
  async consume(key, options, now) {
    const resetsAt = new Date(now.getTime() + options.windowMs);
    const rows = await db.$queryRaw<{ count: number; resetsAt: Date }[]>(
      Prisma.sql`
        INSERT INTO "RateLimitBucket" ("key", "count", "resetsAt", "updatedAt")
        VALUES (${key}, 1, ${resetsAt}, ${now})
        ON CONFLICT ("key") DO UPDATE SET
          "count" = CASE
            WHEN "RateLimitBucket"."resetsAt" <= ${now} THEN 1
            ELSE "RateLimitBucket"."count" + 1
          END,
          "resetsAt" = CASE
            WHEN "RateLimitBucket"."resetsAt" <= ${now} THEN ${resetsAt}
            ELSE "RateLimitBucket"."resetsAt"
          END,
          "updatedAt" = ${now}
        RETURNING "count", "resetsAt"
      `,
    );
    const result = rows[0];
    if (!result) throw new Error("Rate-limit store returned no result.");
    return result;
  },
};

export async function checkRateLimit(
  key: string,
  options: RateLimitOptions = { limit: 60, windowMs: 60_000 },
  store: RateLimitStore = databaseRateLimitStore,
): Promise<RateLimitResult> {
  const now = new Date();
  const entry = await store.consume(key, options, now);
  return {
    allowed: entry.count <= options.limit,
    remaining: Math.max(0, options.limit - entry.count),
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((entry.resetsAt.getTime() - now.getTime()) / 1000),
    ),
  };
}

export function rateLimitKey(
  request: Request,
  resource: string,
  userId?: string,
) {
  if (userId) return `user:${userId}:${resource}`;
  const address =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const digest = createHash("sha256").update(address).digest("hex");
  return `anonymous:${digest}:${resource}`;
}

export function rateLimitPolicy(resource: string): RateLimitOptions {
  if (resource === "reports") return { limit: 10, windowMs: 60 * 60_000 };
  if (resource === "predictions") return { limit: 30, windowMs: 60_000 };
  return { limit: 60, windowMs: 60_000 };
}
