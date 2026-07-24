ALTER TABLE "User"
ADD COLUMN "mutedUntil" TIMESTAMP(3),
ADD COLUMN "bannedAt" TIMESTAMP(3);

CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resetsAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "RateLimitBucket_resetsAt_idx"
ON "RateLimitBucket"("resetsAt");
