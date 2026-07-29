CREATE TYPE "GameMomentType" AS ENUM (
  'SCORE',
  'LEAD_CHANGE',
  'TIE',
  'TURNOVER',
  'PENALTY',
  'EJECTION',
  'PERIOD_END',
  'GAME_START',
  'GAME_END',
  'OTHER'
);

CREATE TYPE "FlashThreadStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

CREATE TABLE "GameMoment" (
  "id" UUID NOT NULL,
  "gameId" UUID NOT NULL,
  "provider" TEXT NOT NULL,
  "providerRef" TEXT NOT NULL,
  "type" "GameMomentType" NOT NULL,
  "title" VARCHAR(240) NOT NULL,
  "description" VARCHAR(2000),
  "period" TEXT,
  "clock" TEXT,
  "homeScore" INTEGER,
  "awayScore" INTEGER,
  "importance" INTEGER NOT NULL DEFAULT 0,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "GameMoment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FlashThread" (
  "id" UUID NOT NULL,
  "gameId" UUID NOT NULL,
  "momentId" UUID NOT NULL,
  "title" VARCHAR(240) NOT NULL,
  "status" "FlashThreadStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),

  CONSTRAINT "FlashThread_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Take"
  ADD COLUMN "flashThreadId" UUID,
  ADD COLUMN "gamePeriod" TEXT,
  ADD COLUMN "gameClock" TEXT,
  ADD COLUMN "homeScoreContext" INTEGER,
  ADD COLUMN "awayScoreContext" INTEGER;

CREATE UNIQUE INDEX "GameMoment_provider_providerRef_key"
  ON "GameMoment"("provider", "providerRef");
CREATE INDEX "GameMoment_gameId_occurredAt_idx"
  ON "GameMoment"("gameId", "occurredAt");
CREATE INDEX "GameMoment_gameId_importance_idx"
  ON "GameMoment"("gameId", "importance");
CREATE UNIQUE INDEX "FlashThread_momentId_key"
  ON "FlashThread"("momentId");
CREATE INDEX "FlashThread_gameId_createdAt_idx"
  ON "FlashThread"("gameId", "createdAt");
CREATE INDEX "Take_flashThreadId_createdAt_idx"
  ON "Take"("flashThreadId", "createdAt" DESC);

ALTER TABLE "GameMoment"
  ADD CONSTRAINT "GameMoment_gameId_fkey"
  FOREIGN KEY ("gameId") REFERENCES "Game"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FlashThread"
  ADD CONSTRAINT "FlashThread_gameId_fkey"
  FOREIGN KEY ("gameId") REFERENCES "Game"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FlashThread"
  ADD CONSTRAINT "FlashThread_momentId_fkey"
  FOREIGN KEY ("momentId") REFERENCES "GameMoment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Take"
  ADD CONSTRAINT "Take_flashThreadId_fkey"
  FOREIGN KEY ("flashThreadId") REFERENCES "FlashThread"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
