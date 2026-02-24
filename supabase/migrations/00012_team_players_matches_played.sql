-- Migration 00012: Add matches_played to team_players
--
-- Stores the number of matches played in the current session for each
-- player on a team. Updated on every scoresheet import so it always
-- reflects the latest value from APA.

ALTER TABLE team_players
  ADD COLUMN IF NOT EXISTS matches_played integer NOT NULL DEFAULT 0
    CHECK (matches_played >= 0);
