-- Migration 00028: Rename race_to → racks_needed, games_won → racks_won
-- race_to columns existed but were never written; no data migration needed.
-- games_won columns also existed but were never written.

DO $$ BEGIN
  ALTER TABLE individual_matches RENAME COLUMN home_race_to TO home_racks_needed;
EXCEPTION WHEN undefined_column OR duplicate_column THEN NULL;
END; $$;
DO $$ BEGIN
  ALTER TABLE individual_matches RENAME COLUMN away_race_to TO away_racks_needed;
EXCEPTION WHEN undefined_column OR duplicate_column THEN NULL;
END; $$;
DO $$ BEGIN
  ALTER TABLE individual_matches RENAME COLUMN home_games_won TO home_racks_won;
EXCEPTION WHEN undefined_column OR duplicate_column THEN NULL;
END; $$;
DO $$ BEGIN
  ALTER TABLE individual_matches RENAME COLUMN away_games_won TO away_racks_won;
EXCEPTION WHEN undefined_column OR duplicate_column THEN NULL;
END; $$;
