import { randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";

export async function withJobLease<T>(
  key: string,
  work: () => Promise<T>,
  durationMs = 300_000,
) {
  const owner = randomUUID();
  const expiresAt = new Date(Date.now() + durationMs);
  const rows = await db.$queryRaw<{ owner: string }[]>`
    INSERT INTO "JobLease" ("key", "owner", "expiresAt")
    VALUES (${key}, ${owner}, ${expiresAt})
    ON CONFLICT ("key") DO UPDATE SET "owner" = EXCLUDED."owner", "expiresAt" = EXCLUDED."expiresAt"
    WHERE "JobLease"."expiresAt" <= NOW()
    RETURNING "owner"
  `;
  if (!rows.length) return { skipped: true as const };
  try {
    return await work();
  } finally {
    await db.jobLease.deleteMany({ where: { key, owner } });
  }
}
