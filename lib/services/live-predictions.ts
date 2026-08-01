import { Prisma, type PrismaClient } from "@prisma/client";

export type PredictionTemplate = { key: string; question: string; options: string[]; lockSeconds: number; resolveFrom: "SCORE" | "GAME_END" };

export function templatesForGame(input: { sportKey: string; home: string; away: string; status: string }): PredictionTemplate[] {
  if (!["LIVE", "HALFTIME"].includes(input.status)) return [];
  const teams = [input.away, input.home];
  const nextTeam = (key: string, question: string, seconds: number): PredictionTemplate => ({ key, question, options: [...teams, "No more scoring"], lockSeconds: seconds, resolveFrom: "SCORE" });
  if (input.sportKey === "football") return [nextTeam("next-scoring-team", "Who scores next?", 45)];
  if (input.sportKey === "basketball") return [nextTeam("next-basket", "Who scores the next basket?", 30)];
  if (input.sportKey === "hockey") return [nextTeam("next-goal", "Who scores the next goal?", 45)];
  if (input.sportKey === "soccer") return [nextTeam("next-goal", "Who scores the next goal?", 60)];
  if (input.sportKey === "baseball") return [{ key: "next-inning-scoreless", question: "Will the next inning be scoreless?", options: ["Yes", "No"], lockSeconds: 60, resolveFrom: "SCORE" }];
  return [];
}

export function predictionStatus(lockAt: Date, now = new Date()): "UPCOMING" | "OPEN" | "LOCKED" { return now >= lockAt ? "LOCKED" : "OPEN"; }

export async function ensureLivePredictions(db: PrismaClient, gameId: string, now = new Date()) {
  const game = await db.game.findUnique({ where: { id: gameId }, include: { league: { include: { sport: true } }, homeTeam: true, awayTeam: true } });
  if (!game) return [];
  for (const template of templatesForGame({ sportKey: game.league.sport.key, home: game.homeTeam.name, away: game.awayTeam.name, status: game.status })) {
    const existing = await db.livePrediction.findUnique({ where: { gameId_templateKey: { gameId, templateKey: template.key } } });
    if (!existing) {
      await db.livePrediction.create({ data: { gameId, templateKey: template.key, question: template.question, options: template.options, lockAt: new Date(now.getTime() + template.lockSeconds * 1000), status: "OPEN" } });
    } else if (existing.status === "OPEN" && now >= existing.lockAt) {
      await db.livePrediction.update({ where: { id: existing.id }, data: { status: "LOCKED" } });
    }
  }
  return db.livePrediction.findMany({ where: { gameId }, include: { votes: true }, orderBy: { createdAt: "desc" } });
}

export async function voteLivePrediction(db: PrismaClient, predictionId: string, userId: string, option: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const prediction = await tx.livePrediction.findUnique({ where: { id: predictionId } });
    if (!prediction) throw new Error("PREDICTION_NOT_FOUND");
    if (prediction.status !== "OPEN" || now >= prediction.lockAt) throw new Error("PREDICTION_LOCKED");
    const options = Array.isArray(prediction.options) ? prediction.options : [];
    if (!options.includes(option)) throw new Error("INVALID_OPTION");
    return tx.livePredictionVote.create({ data: { predictionId, userId, option } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function resolveLivePredictions(db: PrismaClient, gameId: string, now = new Date()) {
  const game = await db.game.findUnique({ where: { id: gameId }, include: { moments: { orderBy: { occurredAt: "asc" } }, livePredictions: { include: { votes: true } }, homeTeam: true, awayTeam: true } });
  if (!game) throw new Error("GAME_NOT_FOUND");
  let resolved = 0;
  for (const prediction of game.livePredictions) {
    if (!["OPEN", "LOCKED"].includes(prediction.status)) continue;
    const score = game.moments.find((moment) => moment.type === "SCORE" && moment.occurredAt >= prediction.createdAt);
    if (!score) continue;
    const previous = [...game.moments].reverse().find((moment) => moment.occurredAt < score.occurredAt && moment.homeScore !== null && moment.awayScore !== null);
    const homeDelta = (score.homeScore ?? 0) - (previous?.homeScore ?? game.homeScore ?? 0);
    const awayDelta = (score.awayScore ?? 0) - (previous?.awayScore ?? game.awayScore ?? 0);
    const answer = homeDelta > awayDelta ? game.homeTeam.name : awayDelta > homeDelta ? game.awayTeam.name : "No more scoring";
    const updated = await db.livePrediction.updateMany({ where: { id: prediction.id, status: { in: ["OPEN", "LOCKED"] } }, data: { status: "RESOLVED", correctOption: answer, sourceMomentId: score.id, resolvedAt: now } });
    if (!updated.count) continue;
    resolved += updated.count;
    for (const vote of prediction.votes) {
      const correct = vote.option === answer;
      try {
        if (correct) await db.fanScoreEvent.create({ data: { userId: vote.userId, eventType: "CORRECT_PREDICTION", sourceType: "LIVE_PREDICTION", sourceId: prediction.id, points: 20, reason: "Correct live prediction", idempotencyKey: `live-prediction:${prediction.id}:${vote.userId}` } });
        await db.profile.upsert({ where: { userId: vote.userId }, create: { userId: vote.userId, favoriteSports: [], favoriteTeams: [], reputation: correct ? 20 : 0, predictionCorrect: correct ? 1 : 0, predictionTotal: 1, predictionCurrentStreak: correct ? 1 : 0, predictionBestStreak: correct ? 1 : 0 }, update: { reputation: correct ? { increment: 20 } : undefined, predictionCorrect: correct ? { increment: 1 } : undefined, predictionTotal: { increment: 1 }, predictionCurrentStreak: correct ? { increment: 1 } : { set: 0 } } });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
      }
    }
  }
  return { resolved };
}