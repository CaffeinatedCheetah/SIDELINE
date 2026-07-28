import { Prisma, type GameStatus } from "@prisma/client";

import { db } from "@/lib/db/client";
import { createNotification } from "@/lib/notifications/service";
import { recordSportsMetric } from "@/lib/sports/observability";
import { resolveGamePredictions } from "@/lib/services/prediction-resolution";
import type { Contest } from "@/lib/sports/types";

function databaseStatus(state: Contest["state"]): GameStatus {
  if (["in_progress", "halftime"].includes(state)) return "LIVE";
  if (state === "final") return "FINAL";
  if (state === "postponed" || state === "suspended") return "POSTPONED";
  if (state === "cancelled") return "CANCELED";
  return "SCHEDULED";
}

export async function materializeContest(
  contest: Contest,
  { maxAttempts = 3 }: { maxAttempts?: number } = {},
) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const materialized = await db.$transaction(
        async (tx) => {
          const legacyProviderRef = `${contest.provider}-${contest.league.key}-${contest.providerGameId}`;
          let synchronized = await tx.game.findFirst({
            where: {
              providerRef: { in: [contest.id, legacyProviderRef] },
            },
            include: {
              league: true,
              homeTeam: true,
              awayTeam: true,
              _count: { select: { takes: true } },
            },
          });
          if (synchronized && synchronized.providerRef !== contest.id)
            synchronized = await tx.game.update({
              where: { id: synchronized.id },
              data: { providerRef: contest.id },
              include: {
                league: true,
                homeTeam: true,
                awayTeam: true,
                _count: { select: { takes: true } },
              },
            });
          if (
            synchronized?.providerUpdatedAt?.toISOString() ===
            contest.providerUpdatedAt
          ) {
            return {
              game: synchronized,
              duplicatePrevented: true,
              previousState: synchronized.providerState,
              unchanged: true,
            };
          }
          const sport = await tx.sport.upsert({
            where: { key: contest.league.sportKey },
            create: {
              key: contest.league.sportKey,
              name: contest.league.sportName,
            },
            update: { name: contest.league.sportName, active: true },
          });
          const league = await tx.league.upsert({
            where: { key: contest.league.key },
            create: {
              sportId: sport.id,
              key: contest.league.key,
              name: contest.league.name,
              abbreviation: contest.league.abbreviation,
            },
            update: {
              sportId: sport.id,
              name: contest.league.name,
              abbreviation: contest.league.abbreviation,
              active: true,
            },
          });
          const upsertParticipant = (side: "home" | "away") => {
            const participant =
              side === "home"
                ? contest.homeParticipant
                : contest.awayParticipant;
            return tx.team.upsert({
              where: {
                key: `${contest.provider}:${contest.league.key}:${participant.providerId}`,
              },
              create: {
                leagueId: league.id,
                key: `${contest.provider}:${contest.league.key}:${participant.providerId}`,
                name: participant.name,
                abbreviation: participant.abbreviation,
                logoUrl: participant.logoUrl,
              },
              update: {
                leagueId: league.id,
                name: participant.name,
                abbreviation: participant.abbreviation,
                logoUrl: participant.logoUrl,
              },
            });
          };
          const [homeTeam, awayTeam] = await Promise.all([
            upsertParticipant("home"),
            upsertParticipant("away"),
          ]);
          const existing = synchronized;
          const now = new Date();
          const game = await tx.game.upsert({
            where: { providerRef: contest.id },
            create: {
              providerRef: contest.id,
              provider: contest.provider,
              providerState: contest.state,
              providerPayloadVersion: contest.versions.payload,
              providerSchemaVersion: contest.versions.schema,
              providerAdapterVersion: contest.versions.adapter,
              providerUpdatedAt: new Date(contest.providerUpdatedAt),
              lastSyncedAt: now,
              leagueId: league.id,
              homeTeamId: homeTeam.id,
              awayTeamId: awayTeam.id,
              season: contest.season,
              venue: contest.venue,
              broadcast: contest.broadcast,
              statusDetail: contest.detail,
              scheduledAt: new Date(contest.scheduledAtUtc),
              status: databaseStatus(contest.state),
              homeScore: contest.homeScore,
              awayScore: contest.awayScore,
              period: contest.period,
              clock: contest.clock,
            },
            update: {
              providerState: contest.state,
              providerPayloadVersion: contest.versions.payload,
              providerSchemaVersion: contest.versions.schema,
              providerAdapterVersion: contest.versions.adapter,
              providerUpdatedAt: new Date(contest.providerUpdatedAt),
              lastSyncedAt: now,
              leagueId: league.id,
              homeTeamId: homeTeam.id,
              awayTeamId: awayTeam.id,
              season: contest.season,
              venue: contest.venue,
              broadcast: contest.broadcast,
              statusDetail: contest.detail,
              scheduledAt: new Date(contest.scheduledAtUtc),
              status: databaseStatus(contest.state),
              homeScore: contest.homeScore ?? null,
              awayScore: contest.awayScore ?? null,
              period: contest.period,
              clock: contest.clock,
              version: { increment: 1 },
            },
            include: {
              league: true,
              homeTeam: true,
              awayTeam: true,
              _count: { select: { takes: true } },
            },
          });
          return {
            game,
            duplicatePrevented: Boolean(existing),
            previousState: existing?.providerState,
            unchanged: false,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      recordSportsMetric("contest_synchronized", {
        league: contest.league.key,
        metadata: {
          provider: contest.provider,
          schemaVersion: contest.versions.schema,
          adapterVersion: contest.versions.adapter,
        },
      });
      if (materialized.duplicatePrevented)
        recordSportsMetric("duplicate_prevented", {
          league: contest.league.key,
        });
      if (
        !materialized.unchanged &&
        materialized.previousState !== contest.state &&
        ["in_progress", "halftime", "delayed", "postponed", "final"].includes(
          contest.state,
        )
      ) {
        const followers = await db.gameFollow.findMany({
          where: { gameId: materialized.game.id, notifications: true },
          select: { userId: true },
        });
        await Promise.allSettled(
          followers.map(({ userId }) =>
            createNotification(db, {
              recipientId: userId,
              type: "GAME",
              entityType: "GAME",
              entityId: materialized.game.id,
              href: `/games/${materialized.game.id}`,
              deduplicationKey: `game-state:${materialized.game.id}:${contest.state}:${userId}`,
              payload: {
                state: contest.state,
                detail: contest.detail,
              },
            }),
          ),
        );
      }
      if (
        ["FINAL", "POSTPONED", "CANCELED"].includes(materialized.game.status)
      ) {
        try {
          await resolveGamePredictions(db, materialized.game.id);
        } catch {
          recordSportsMetric("materialization_failure", {
            league: contest.league.key,
            metadata: { operation: "prediction_resolution" },
          });
        }
      }
      return materialized.game;
    } catch (error) {
      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2002", "P2034"].includes(error.code);
      if (retryable && attempt < maxAttempts) continue;
      recordSportsMetric("materialization_failure", {
        league: contest.league.key,
        metadata: { attempt, retryable },
      });
      throw error;
    }
  }
  throw new Error("Contest materialization exhausted retries");
}

export async function materializeContests(contests: Contest[]) {
  const games = [];
  for (const contest of contests) {
    games.push(await materializeContest(contest));
  }
  return games;
}
