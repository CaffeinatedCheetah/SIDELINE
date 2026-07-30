-- Release 2.2: additive team-follow relationship for My SIDELINE.
CREATE TABLE "TeamFollow" (
    "userId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamFollow_pkey" PRIMARY KEY ("userId","teamId")
);

CREATE INDEX "TeamFollow_teamId_idx" ON "TeamFollow"("teamId");

ALTER TABLE "TeamFollow"
ADD CONSTRAINT "TeamFollow_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeamFollow"
ADD CONSTRAINT "TeamFollow_teamId_fkey"
FOREIGN KEY ("teamId") REFERENCES "Team"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
