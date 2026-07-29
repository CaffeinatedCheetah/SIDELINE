-- Preserve existing records while adopting the canonical lifecycle spelling.
ALTER TYPE "GameStatus" RENAME VALUE 'CANCELED' TO 'CANCELLED';
ALTER TYPE "GameStatus" ADD VALUE IF NOT EXISTS 'PREGAME' BEFORE 'LIVE';
ALTER TYPE "GameStatus" ADD VALUE IF NOT EXISTS 'HALFTIME' AFTER 'LIVE';

-- Lifecycle and synchronization queries use these fields together.
CREATE INDEX "Game_status_lastSyncedAt_idx" ON "Game"("status", "lastSyncedAt");
