CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "User_displayName_trgm_idx"
ON "User" USING gin ("displayName" gin_trgm_ops);

CREATE INDEX "User_handle_trgm_idx"
ON "User" USING gin ("handle" gin_trgm_ops);

CREATE INDEX "Team_name_trgm_idx"
ON "Team" USING gin ("name" gin_trgm_ops);

CREATE INDEX "Team_abbreviation_trgm_idx"
ON "Team" USING gin ("abbreviation" gin_trgm_ops);

CREATE INDEX "Community_name_trgm_idx"
ON "Community" USING gin ("name" gin_trgm_ops);

CREATE INDEX "Debate_title_trgm_idx"
ON "Debate" USING gin ("title" gin_trgm_ops);
