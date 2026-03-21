-- Migration 00028: Rename SL columns, add format-specific SL to team_players,
-- add game_format to skill_level_history.

-- ── players table ──────────────────────────────────────────────────────────
-- Rename eight_ball_sl / nine_ball_sl (added in 00023) to current_* naming.
ALTER TABLE players RENAME COLUMN eight_ball_sl TO current_8_ball_sl;
ALTER TABLE players RENAME COLUMN nine_ball_sl  TO current_9_ball_sl;
-- Drop legacy single-format column (current_* columns are nullable —
-- a player may only play one format).
ALTER TABLE players DROP COLUMN skill_level;

-- ── team_players table ─────────────────────────────────────────────────────
-- Add format-specific SL columns (nullable — player may only play one format).
ALTER TABLE team_players
  ADD COLUMN IF NOT EXISTS current_8_ball_sl integer CHECK (current_8_ball_sl BETWEEN 1 AND 9);
ALTER TABLE team_players
  ADD COLUMN IF NOT EXISTS current_9_ball_sl integer CHECK (current_9_ball_sl BETWEEN 1 AND 9);
-- Drop legacy column (was never written by importer — always defaulted to 3).
ALTER TABLE team_players DROP COLUMN skill_level;

-- ── skill_level_history table ──────────────────────────────────────────────
-- Add game_format so history entries are format-specific.
-- Add nullable first to handle any existing rows, then constrain NOT NULL.
ALTER TABLE skill_level_history ADD COLUMN game_format game_format;
UPDATE skill_level_history SET game_format = 'eight_ball' WHERE game_format IS NULL;
ALTER TABLE skill_level_history ALTER COLUMN game_format SET NOT NULL;

-- ── find_player_by_member_number RPC ──────────────────────────────────────
DROP FUNCTION IF EXISTS public.find_player_by_member_number(text);
CREATE FUNCTION public.find_player_by_member_number(p_member_number text)
RETURNS TABLE (
  id                uuid,
  first_name        text,
  last_name         text,
  member_number     text,
  current_8_ball_sl integer,
  current_9_ball_sl integer,
  game_format       game_format
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, first_name, last_name, member_number,
         current_8_ball_sl, current_9_ball_sl, game_format
  FROM players
  WHERE member_number = p_member_number
  LIMIT 1;
$$;
