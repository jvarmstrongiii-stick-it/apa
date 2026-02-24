-- Migration 00015: Put-up flow, resume timestamps, innings verification
--
-- Adds columns to support:
--   1. Real-time two-device put-up player selection
--   2. Match resume timestamps (logged when a team resumes a match)
--   3. Per-rack innings verification between both scorekeepers
--   4. RLS policies for reading opponent player data during put-up
--
-- NOTE: Supabase Realtime must be enabled for the individual_matches table
-- in the Supabase dashboard (Table Editor → individual_matches → Enable Realtime).

-- ============================================================
-- INDIVIDUAL_MATCHES
-- ============================================================

-- put_up_team: which team ('home' or 'away') puts up their player first
-- for this individual match. Determined by coin flip for match 1,
-- then by the loser of the previous individual match.
ALTER TABLE individual_matches
  ADD COLUMN IF NOT EXISTS put_up_team text CHECK (put_up_team IN ('home', 'away'));

-- resumed_at: timestamp recorded when a team taps to resume this
-- individual match after an interruption.
ALTER TABLE individual_matches
  ADD COLUMN IF NOT EXISTS resumed_at timestamptz;

-- Unique constraint to enable safe upsert from two devices simultaneously.
-- Both devices may attempt to create the individual_match record at the same
-- time; the UNIQUE constraint ensures only one row is created.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'individual_matches_unique_match_order'
  ) THEN
    ALTER TABLE individual_matches
      ADD CONSTRAINT individual_matches_unique_match_order
        UNIQUE (team_match_id, match_order);
  END IF;
END $$;

-- ============================================================
-- RACKS_EIGHT_BALL: Per-rack innings verification
--
-- After each rack, both scorekeepers independently enter the inning count.
-- When both values match, innings_verified is set to true and the next
-- rack can proceed. When they disagree, the discrepancy is surfaced for
-- manual resolution.
-- ============================================================

ALTER TABLE racks_eight_ball
  ADD COLUMN IF NOT EXISTS innings_home     integer,
  ADD COLUMN IF NOT EXISTS innings_away     integer,
  ADD COLUMN IF NOT EXISTS innings_verified boolean NOT NULL DEFAULT false;

-- ============================================================
-- RACKS_NINE_BALL: Per-rack innings verification
-- ============================================================

ALTER TABLE racks_nine_ball
  ADD COLUMN IF NOT EXISTS innings_home     integer,
  ADD COLUMN IF NOT EXISTS innings_away     integer,
  ADD COLUMN IF NOT EXISTS innings_verified boolean NOT NULL DEFAULT false;

-- ============================================================
-- RLS: Opponent player visibility during put-up
--
-- When the opponent puts up a player, this team's device needs to
-- read that player's name, skill level, and matches played.
-- The existing policies only allow reading your own team's players.
-- These policies extend read access to players who appear in
-- individual_matches for a team_match involving your team.
-- ============================================================

-- Allow reading players who have been put up against your team
CREATE POLICY players_select_opponent ON players
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM individual_matches im
      JOIN team_matches tm ON tm.id = im.team_match_id
      WHERE (im.home_player_id = players.id OR im.away_player_id = players.id)
        AND (tm.home_team_id = get_user_team_id() OR tm.away_team_id = get_user_team_id())
    )
  );

-- Allow reading opponent's team_players to get their matches_played
CREATE POLICY team_players_select_opponent ON team_players
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM individual_matches im
      JOIN team_matches tm ON tm.id = im.team_match_id
      WHERE (im.home_player_id = team_players.player_id OR im.away_player_id = team_players.player_id)
        AND (tm.home_team_id = get_user_team_id() OR tm.away_team_id = get_user_team_id())
    )
  );
