import { describe, expect, it } from "vitest";

import { canEditContent, canModerate } from "@/lib/permissions/content";
import { FAN_SCORE_POINTS, totalFanScore } from "@/lib/scoring/fan-score";
import { rankHallCandidates } from "@/lib/scoring/hall-of-flame";
import {
  assertPredictionOpen,
  isPredictionLocked,
} from "@/lib/services/predictions";
import { assertVoteAllowed } from "@/lib/services/votes";

describe("Fan Score", () => {
  it("uses a transparent event ledger", () =>
    expect(
      totalFanScore([
        { points: FAN_SCORE_POINTS.QUALITY_TAKE },
        { points: FAN_SCORE_POINTS.MODERATION_PENALTY },
      ]),
    ).toBe(-15));
});

describe("Hall of Flame", () => {
  it("ranks by quality, conversation and trust with deterministic ties", () => {
    const ranked = rankHallCandidates([
      {
        id: "b",
        quality: 1,
        conversation: 0.5,
        trust: 0.5,
        reports: 0,
        isActive: true,
      },
      {
        id: "a",
        quality: 1,
        conversation: 0.5,
        trust: 0.5,
        reports: 0,
        isActive: true,
      },
      {
        id: "removed",
        quality: 1,
        conversation: 1,
        trust: 1,
        reports: 0,
        isActive: false,
      },
    ]);
    expect(ranked.map(({ id }) => id)).toEqual(["a", "b"]);
  });
});

describe("vote and prediction policy", () => {
  it("rejects duplicate debate votes", () =>
    expect(() =>
      assertVoteAllowed({
        userId: "u",
        debateStatus: "OPEN",
        optionBelongsToDebate: true,
        alreadyVoted: true,
      }),
    ).toThrow("DUPLICATE_VOTE"));
  it("locks predictions at the exact lock instant", () => {
    const lock = new Date("2026-01-01T12:00:00Z");
    expect(isPredictionLocked(lock, lock)).toBe(true);
    expect(() =>
      assertPredictionOpen({
        locksAt: lock,
        gameStatus: "SCHEDULED",
        now: lock,
      }),
    ).toThrow("PREDICTION_LOCKED");
  });
});

describe("permissions", () => {
  it("limits author edits and permits moderation roles", () => {
    const createdAt = new Date("2026-01-01T12:00:00Z");
    expect(
      canEditContent({
        actorId: "u",
        authorId: "u",
        role: "USER",
        createdAt,
        now: new Date("2026-01-01T12:14:00Z"),
      }),
    ).toBe(true);
    expect(
      canEditContent({
        actorId: "u",
        authorId: "u",
        role: "USER",
        createdAt,
        now: new Date("2026-01-01T12:16:00Z"),
      }),
    ).toBe(false);
    expect(canModerate("MODERATOR")).toBe(true);
  });
});
