CREATE TABLE "JobLease" (
  "key" TEXT PRIMARY KEY,
  "owner" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "AiUsage" (
  "id" UUID PRIMARY KEY,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "reservedUsd" DECIMAL(12,6) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RESERVED',
  "inputTokens" INTEGER,
  "outputTokens" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AiUsage_provider_createdAt_idx" ON "AiUsage"("provider", "createdAt");
