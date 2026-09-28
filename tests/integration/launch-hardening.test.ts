import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db/client";
import {
  canInteract,
  discoverableUserWhere,
} from "@/lib/permissions/visibility";
import { reserveAiRequest } from "@/lib/ai/budget";
import { finalizeAccountDeletions } from "@/lib/accounts/deletion";
import { createTake } from "@/lib/takes/create-take";
import { withJobLease } from "@/lib/jobs/lease";

const run =
  process.env.RUN_DATABASE_TESTS === "true" ? describe : describe.skip;
run("launch safeguards on PostgreSQL", () => {
  const a = randomUUID(),
    b = randomUUID();
  const providerModel = "integration-" + randomUUID();
  beforeAll(async () => {
    await db.user.createMany({
      data: [
        { id: a, email: a + "@test.local" },
        { id: b, email: b + "@test.local" },
      ],
    });
  });
  afterAll(async () => {
    await db.verificationToken.deleteMany({
      where: { identifier: a + "@test.local" },
    });
    await db.aiUsage.deleteMany({ where: { model: providerModel } });
    await db.fanScoreEvent.deleteMany({ where: { userId: { in: [a, b] } } });
    await db.take.deleteMany({ where: { authorId: { in: [a, b] } } });
    await db.user.deleteMany({ where: { id: { in: [a, b] } } });
    vi.unstubAllEnvs();
  });
  it("excludes a non-discoverable account at the database boundary", async () => {
    await db.userPreference.create({
      data: { userId: b, privacySettings: { profileDiscoverable: false } },
    });
    expect(
      await db.user.findFirst({
        where: { id: b, ...discoverableUserWhere(a) },
      }),
    ).toBeNull();
  });
  it("keeps default privacy settings discoverable", async () => {
    await db.userPreference.create({
      data: { userId: a, privacySettings: {} },
    });
    expect(
      await db.user.findFirst({
        where: { id: a, ...discoverableUserWhere(b) },
      }),
    ).not.toBeNull();
  });
  it("blocks interaction in both directions", async () => {
    await db.block.create({ data: { blockerId: a, blockedId: b } });
    expect(await canInteract(a, { authorId: b, status: "ACTIVE" })).toBe(false);
    expect(await canInteract(b, { authorId: a, status: "ACTIVE" })).toBe(false);
    await db.block.deleteMany({ where: { blockerId: a } });
  });
  it("allows only one concurrent lease holder", async () => {
    const key = "test:" + randomUUID();
    let entered = 0;
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        withJobLease(key, async () => {
          entered++;
          await new Promise((resolve) => setTimeout(resolve, 100));
          return { ok: true };
        }),
      ),
    );
    expect(entered).toBe(1);
    expect(results.filter((result) => "skipped" in result)).toHaveLength(4);
  });
  it("reserves budgets atomically across concurrent paid requests", async () => {
    vi.stubEnv("SCOUT_AI_PRICED_MODEL", providerModel);
    vi.stubEnv("SCOUT_AI_INPUT_USD_PER_MILLION", "1");
    vi.stubEnv("SCOUT_AI_OUTPUT_USD_PER_MILLION", "1");
    vi.stubEnv("SCOUT_AI_DAILY_BUDGET_USD", "100");
    vi.stubEnv("SCOUT_AI_DAILY_GENERATION_LIMIT", "1");
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        reserveAiRequest("anthropic", providerModel, "hello", 10),
      ),
    );
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
  });
  it("does not reward concurrent duplicate takes more than once", async () => {
    const body =
      "A concurrent duplicate should receive only one reward " + randomUUID();
    const takes = await Promise.all(
      Array.from({ length: 3 }, () => createTake({ authorId: a, body })),
    );
    const rewards = await db.fanScoreEvent.findMany({
      where: {
        sourceId: { in: takes.map((take) => take.id) },
        points: { gt: 0 },
      },
    });
    expect(rewards).toHaveLength(1);
  });
  it("finalizes due deletions but leaves accounts inside the grace period alone", async () => {
    await db.user.update({
      where: { id: a },
      data: {
        status: "PENDING_DELETION",
        deletedAt: new Date(Date.now() - 1000),
      },
    });
    await db.user.update({
      where: { id: b },
      data: {
        status: "PENDING_DELETION",
        deletedAt: new Date(Date.now() + 86_400_000),
      },
    });
    await db.verificationToken.create({
      data: {
        identifier: a + "@test.local",
        token: randomUUID(),
        expires: new Date(Date.now() + 60_000),
      },
    });
    await finalizeAccountDeletions();
    expect(
      await db.verificationToken.count({
        where: { identifier: a + "@test.local" },
      }),
    ).toBe(0);
    const deleted = await db.user.findUniqueOrThrow({ where: { id: a } });
    expect(deleted.status).toBe("DELETED");
    expect(deleted.email).toBeNull();
    expect((await db.user.findUniqueOrThrow({ where: { id: b } })).status).toBe(
      "PENDING_DELETION",
    );
  });
});
