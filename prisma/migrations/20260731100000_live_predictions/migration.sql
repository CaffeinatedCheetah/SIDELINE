CREATE TYPE "LivePredictionStatus" AS ENUM ('"'"'UPCOMING'"'"', '"'"'OPEN'"'"', '"'"'LOCKED'"'"', '"'"'RESOLVED'"'"', '"'"'ARCHIVED'"'"');
ALTER TABLE "Profile" ADD COLUMN "predictionCurrentStreak" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Profile" ADD COLUMN "predictionBestStreak" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "LivePrediction" (
  "id" UUID NOT NULL,
  "gameId" UUID NOT NULL,
  "templateKey" TEXT NOT NULL,
  "question" VARCHAR(280) NOT NULL,
  "options" JSONB NOT NULL,
  "lockAt" TIMESTAMP(3) NOT NULL,
  "status" "LivePredictionStatus" NOT NULL DEFAULT '"'"'UPCOMING'"'"',
  "correctOption" TEXT,
  "sourceMomentId" UUID,
  "resolvedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LivePrediction_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "LivePredictionVote" (
  "id" UUID NOT NULL,
  "predictionId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "option" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LivePredictionVote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LivePrediction_gameId_templateKey_key" ON "LivePrediction"("gameId", "templateKey");
CREATE INDEX "LivePrediction_gameId_status_lockAt_idx" ON "LivePrediction"("gameId", "status", "lockAt");
CREATE INDEX "LivePrediction_sourceMomentId_idx" ON "LivePrediction"("sourceMomentId");
CREATE UNIQUE INDEX "LivePredictionVote_predictionId_userId_key" ON "LivePredictionVote"("predictionId", "userId");
CREATE INDEX "LivePredictionVote_predictionId_option_idx" ON "LivePredictionVote"("predictionId", "option");
ALTER TABLE "LivePrediction" ADD CONSTRAINT "LivePrediction_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LivePrediction" ADD CONSTRAINT "LivePrediction_sourceMomentId_fkey" FOREIGN KEY ("sourceMomentId") REFERENCES "GameMoment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LivePredictionVote" ADD CONSTRAINT "LivePredictionVote_predictionId_fkey" FOREIGN KEY ("predictionId") REFERENCES "LivePrediction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LivePredictionVote" ADD CONSTRAINT "LivePredictionVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;