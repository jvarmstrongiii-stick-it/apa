-- Migration 00011: Reconcile DB schema with TypeScript types
-- Renames columns and adds missing fields so the app layer (types.ts) matches
-- what is actually in the database.

-- ============================================================
-- PLAYERS
-- Rename member_id -> member_number
-- Add skill_level, game_format, is_active (required by PlayerInsert)
-- ============================================================

ALTER TABLE players RENAME COLUMN member_id TO member_number;

-- member_number was originally nullable (no NOT NULL in migration 00003).
-- Enforce NOT NULL now — every player must have an APA member number.
ALTER TABLE players ALTER COLUMN member_number SET NOT NULL;

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS skill_level integer NOT NULL DEFAULT 5
    CHECK (skill_level BETWEEN 1 AND 9);

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS game_format game_format NOT NULL DEFAULT 'eight_ball';

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- ============================================================
-- TEAMS
-- Rename number -> team_number (column was nullable text)
-- ============================================================

ALTER TABLE teams RENAME COLUMN number TO team_number;

-- ============================================================
-- DIVISIONS
-- Add optional location column (used in types.ts Division interface)
-- ============================================================

ALTER TABLE divisions ADD COLUMN IF NOT EXISTS location text;

-- ============================================================
-- TEAM_PLAYERS
-- Add is_captain (types.ts uses is_captain, not is_active for captains)
-- Add left_at  (used in TeamPlayer interface)
-- team_players.skill_level stays as-is for now (no-op)
-- ============================================================

ALTER TABLE team_players
  ADD COLUMN IF NOT EXISTS is_captain boolean NOT NULL DEFAULT false;

ALTER TABLE team_players
  ADD COLUMN IF NOT EXISTS left_at timestamptz;

-- skill_level had no DEFAULT, causing inserts from the app (which omit it)
-- to fail. Give it a temporary default; the correct value is now on players.skill_level.
ALTER TABLE team_players ALTER COLUMN skill_level SET DEFAULT 5;

-- ============================================================
-- IMPORTS
-- The original migration has league_id NOT NULL and storage_path NOT NULL,
-- but the app layer (ImportInsert) does not include those fields.
-- Make them nullable so the app can insert without them.
-- Rename success_count/error_count to processed_rows/error_rows.
-- Add file_type, started_at, updated_at.
-- ============================================================

ALTER TABLE imports ALTER COLUMN league_id   DROP NOT NULL;
ALTER TABLE imports ALTER COLUMN storage_path DROP NOT NULL;

ALTER TABLE imports RENAME COLUMN success_count TO processed_rows;
ALTER TABLE imports RENAME COLUMN error_count   TO error_rows;

ALTER TABLE imports
  ADD COLUMN IF NOT EXISTS file_type   text        NOT NULL DEFAULT 'pdf';

ALTER TABLE imports
  ADD COLUMN IF NOT EXISTS started_at  timestamptz;

ALTER TABLE imports
  ADD COLUMN IF NOT EXISTS updated_at  timestamptz NOT NULL DEFAULT now();

-- ============================================================
-- TEAM_MATCHES
-- Rename match_status -> status (matches TeamMatch.status in types.ts)
-- Rename home_points/away_points -> home_score/away_score
-- Add locked_by / locked_at (used in TeamMatch / TeamMatchUpdate)
-- Drop is_finalized (finalized_at / finalized_by already exist)
-- Drop offline_version (not in types.ts)
-- ============================================================

ALTER TABLE team_matches RENAME COLUMN match_status  TO status;
ALTER TABLE team_matches RENAME COLUMN home_points   TO home_score;
ALTER TABLE team_matches RENAME COLUMN away_points   TO away_score;

ALTER TABLE team_matches
  ADD COLUMN IF NOT EXISTS locked_by  uuid REFERENCES profiles (id);

ALTER TABLE team_matches
  ADD COLUMN IF NOT EXISTS locked_at  timestamptz;

ALTER TABLE team_matches DROP COLUMN IF EXISTS is_finalized;
ALTER TABLE team_matches DROP COLUMN IF EXISTS offline_version;
