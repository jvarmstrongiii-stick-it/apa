-- Migration 00023: Roster Editing + Player Identity
--
-- Adds:
--   1. Dual skill-level columns on players (eight_ball_sl, nine_ball_sl)
--   2. team_players.skill_level default changed from 5 → 3 (new players start at SL 3)
--   3. profiles.player_id — which player this session belongs to
--   4. set_player_identity(uuid) RPC — SECURITY DEFINER, sets profiles.player_id
--   5. get_user_player_id() helper function
--   6. is_team_captain() helper function
--   7. find_player_by_member_number(text) RPC — SECURITY DEFINER lookup for Add Player flow
--   8. RLS policies for captain-level roster editing (UPDATE/INSERT on team_players)
--   9. RLS policy allowing captain to insert new players into the players table

-- ============================================================
-- PLAYERS: dual skill-level columns
-- ============================================================

-- eight_ball_sl: APA 8-ball skill level for this player (1–9, nullable)
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS eight_ball_sl integer CHECK (eight_ball_sl BETWEEN 1 AND 9);

-- nine_ball_sl: APA 9-ball skill level for this player (1–9, nullable)
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS nine_ball_sl integer CHECK (nine_ball_sl BETWEEN 1 AND 9);

-- Migrate existing skill_level data into the correct format column.
-- skill_level is kept as-is for backward compatibility (scoring screens still read it).
UPDATE players SET eight_ball_sl = skill_level WHERE game_format = 'eight_ball' AND eight_ball_sl IS NULL;
UPDATE players SET nine_ball_sl  = skill_level WHERE game_format = 'nine_ball'  AND nine_ball_sl  IS NULL;

-- ============================================================
-- TEAM_PLAYERS: change skill_level default from 5 → 3
-- New/unknown players begin at SL 3 per APA rules.
-- Their first scoresheet may show SL 0; captain can correct in roster edit.
-- ============================================================

ALTER TABLE team_players ALTER COLUMN skill_level SET DEFAULT 3;

-- ============================================================
-- PROFILES: add player_id (which player this session belongs to)
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS player_id uuid REFERENCES players(id) ON DELETE SET NULL;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Returns the player_id stored on the current user's profile (NULL if not set).
CREATE OR REPLACE FUNCTION public.get_user_player_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT player_id FROM profiles WHERE id = auth.uid();
$$;

-- Returns true if the current user's player_id is a captain (or co-captain)
-- on their assigned team, and is still active on that roster.
CREATE OR REPLACE FUNCTION public.is_team_captain()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_players
    WHERE team_id   = get_user_team_id()
      AND player_id = get_user_player_id()
      AND is_captain = true
      AND left_at IS NULL
  );
$$;

-- ============================================================
-- set_player_identity RPC
-- Called after the player picks their name from the roster.
-- Updates profiles.player_id for the current user.
-- SECURITY DEFINER so anonymous team users can update their own profile
-- without a client-side UPDATE policy for player_id.
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_player_identity(p_player_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE profiles
  SET player_id  = p_player_id,
      updated_at = now()
  WHERE id = auth.uid();
$$;

-- ============================================================
-- find_player_by_member_number RPC
-- Used by the Add Player flow to look up an existing player
-- by APA member number. Returns NULL if not found.
-- SECURITY DEFINER so team users can search all players (not just
-- those already on their roster), without opening a broad SELECT policy.
-- ============================================================

CREATE OR REPLACE FUNCTION public.find_player_by_member_number(p_member_number text)
RETURNS TABLE (
  id            uuid,
  first_name    text,
  last_name     text,
  member_number text,
  skill_level   integer,
  eight_ball_sl integer,
  nine_ball_sl  integer,
  game_format   game_format
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, first_name, last_name, member_number,
         skill_level, eight_ball_sl, nine_ball_sl, game_format
  FROM players
  WHERE member_number = p_member_number
  LIMIT 1;
$$;

-- ============================================================
-- check_division_conflict RPC
-- Returns the conflicting team name if the given player is already
-- on another team in the same division (and hasn't left that team).
-- Returns NULL if there is no conflict.
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_division_conflict(
  p_player_id uuid,
  p_team_id   uuid
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.name
  FROM team_players tp
  JOIN teams t ON t.id = tp.team_id
  WHERE tp.player_id = p_player_id
    AND tp.left_at IS NULL
    AND tp.team_id <> p_team_id
    AND t.division_id = (SELECT division_id FROM teams WHERE id = p_team_id)
  LIMIT 1;
$$;

-- ============================================================
-- RLS: Captain-level roster editing
--
-- Captains (and co-captains) can:
--   - UPDATE team_players rows on their own team (to soft-delete or toggle is_captain)
--   - INSERT new team_players rows on their own team (to add a player)
--   - INSERT new players into the players table (for brand-new APA members)
-- ============================================================

-- Allow captains to update their team's roster entries
-- (used for soft-delete via left_at, and for co-captain promotion/demotion)
CREATE POLICY team_players_update_captain ON team_players
  FOR UPDATE USING (
    team_id = get_user_team_id()
    AND is_team_captain()
  );

-- Allow captains to add players to their team's roster
CREATE POLICY team_players_insert_captain ON team_players
  FOR INSERT WITH CHECK (
    team_id = get_user_team_id()
    AND is_team_captain()
  );

-- Allow captains to insert brand-new players into the players table.
-- (Only needed when the member number is not already in the system.)
CREATE POLICY players_insert_captain ON players
  FOR INSERT WITH CHECK (is_team_captain());

-- Allow captains to read any player (needed for "Add Player" member number lookup).
-- This complements find_player_by_member_number (RPC) but also covers
-- any direct queries the client may need post-add.
CREATE POLICY players_select_captain ON players
  FOR SELECT USING (is_team_captain());
