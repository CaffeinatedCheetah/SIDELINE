-- Release 3.0 adds a first-class notification category for @mentions.
-- This is additive and does not rewrite existing notification records.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MENTION';
