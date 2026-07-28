ALTER TABLE "Game"
  ADD COLUMN "provider" TEXT,
  ADD COLUMN "providerState" TEXT,
  ADD COLUMN "providerPayloadVersion" TEXT,
  ADD COLUMN "providerSchemaVersion" TEXT,
  ADD COLUMN "providerAdapterVersion" TEXT,
  ADD COLUMN "season" TEXT,
  ADD COLUMN "venue" TEXT,
  ADD COLUMN "broadcast" TEXT,
  ADD COLUMN "statusDetail" TEXT,
  ADD COLUMN "providerUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "lastSyncedAt" TIMESTAMP(3);

CREATE INDEX "Game_provider_lastSyncedAt_idx"
  ON "Game"("provider", "lastSyncedAt");

CREATE TABLE "OperationalJobRun" (
  "id" UUID NOT NULL,
  "jobKey" TEXT NOT NULL,
  "period" TEXT,
  "status" TEXT NOT NULL,
  "lockKey" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "eligibleCount" INTEGER NOT NULL DEFAULT 0,
  "processedCount" INTEGER NOT NULL DEFAULT 0,
  "skippedCount" INTEGER NOT NULL DEFAULT 0,
  "errorCount" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OperationalJobRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OperationalJobRun_lockKey_key"
  ON "OperationalJobRun"("lockKey");
CREATE INDEX "OperationalJobRun_jobKey_period_startedAt_idx"
  ON "OperationalJobRun"("jobKey", "period", "startedAt" DESC);
CREATE INDEX "OperationalJobRun_status_startedAt_idx"
  ON "OperationalJobRun"("status", "startedAt");

ALTER TABLE "Notification" ADD COLUMN "deduplicationKey" TEXT;
CREATE UNIQUE INDEX "Notification_deduplicationKey_key"
  ON "Notification"("deduplicationKey");

ALTER TABLE "FanScoreEvent" ADD COLUMN "reversalOfEventId" TEXT;
CREATE UNIQUE INDEX "FanScoreEvent_reversalOfEventId_key"
  ON "FanScoreEvent"("reversalOfEventId");
