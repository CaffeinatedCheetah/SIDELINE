-- Release 3.1A: additive AI artifact lifecycle and authenticated feedback.
CREATE TYPE "AiArtifactType" AS ENUM ('GAME_RECAP');
CREATE TYPE "AiEntityType" AS ENUM ('GAME');
CREATE TYPE "AiArtifactStatus" AS ENUM (
  'PENDING',
  'GENERATING',
  'READY',
  'INSUFFICIENT_DATA',
  'FAILED',
  'STALE'
);
CREATE TYPE "AiFeedbackValue" AS ENUM ('HELPFUL', 'NOT_HELPFUL');
CREATE TYPE "AiFeedbackReason" AS ENUM (
  'INACCURATE',
  'MISSING_CONTEXT',
  'HARD_TO_READ',
  'TOO_LONG',
  'OTHER'
);

CREATE TABLE "AiArtifact" (
  "id" UUID NOT NULL,
  "type" "AiArtifactType" NOT NULL,
  "entityType" "AiEntityType" NOT NULL,
  "entityId" UUID NOT NULL,
  "status" "AiArtifactStatus" NOT NULL DEFAULT 'PENDING',
  "schemaVersion" TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "contextVersion" TEXT NOT NULL,
  "model" TEXT,
  "content" JSONB,
  "sourceManifest" JSONB,
  "contextHash" TEXT NOT NULL,
  "contentHash" TEXT,
  "inputTokens" INTEGER,
  "outputTokens" INTEGER,
  "cachedTokens" INTEGER,
  "estimatedCost" DECIMAL(12,6),
  "latencyMs" INTEGER,
  "providerRequestId" TEXT,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "cacheHitCount" INTEGER NOT NULL DEFAULT 0,
  "generatedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiArtifact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiArtifactFeedback" (
  "artifactId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "value" "AiFeedbackValue" NOT NULL,
  "reason" "AiFeedbackReason",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiArtifactFeedback_pkey" PRIMARY KEY ("artifactId", "userId")
);

CREATE UNIQUE INDEX "AiArtifact_type_entityType_entityId_contextHash_key"
  ON "AiArtifact"("type", "entityType", "entityId", "contextHash");
CREATE INDEX "AiArtifact_entityType_entityId_status_idx"
  ON "AiArtifact"("entityType", "entityId", "status");
CREATE INDEX "AiArtifact_status_createdAt_idx"
  ON "AiArtifact"("status", "createdAt");
CREATE INDEX "AiArtifact_type_generatedAt_idx"
  ON "AiArtifact"("type", "generatedAt");
CREATE INDEX "AiArtifactFeedback_artifactId_value_idx"
  ON "AiArtifactFeedback"("artifactId", "value");

ALTER TABLE "AiArtifactFeedback"
  ADD CONSTRAINT "AiArtifactFeedback_artifactId_fkey"
  FOREIGN KEY ("artifactId") REFERENCES "AiArtifact"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiArtifactFeedback"
  ADD CONSTRAINT "AiArtifactFeedback_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
