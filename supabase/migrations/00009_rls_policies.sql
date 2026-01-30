-- Migration 00009: Row Level Security Policies
-- Enables RLS on all tables and defines access policies based on user role and team membership.

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Returns the role of the currently authenticated user.
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- Returns the team_id of the currently authenticated user (NULL for admins without a team).
CREATE OR REPLACE FUNCTION public.get_user_team_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_id FROM profiles WHERE id = auth.uid();
$$;

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================
ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE leagues               ENABLE ROW LEVEL SECURITY;
ALTER TABLE divisions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE players               ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_players          ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_level_history   ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_matches          ENABLE ROW LEVEL SECURITY;
ALTER TABLE lineups               ENABLE ROW LEVEL SECURITY;
ALTER TABLE individual_matches    ENABLE ROW LEVEL SECURITY;
ALTER TABLE racks_eight_ball      ENABLE ROW LEVEL SECURITY;
ALTER TABLE racks_nine_ball       ENABLE ROW LEVEL SECURITY;
ALTER TABLE scorecard_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE imports               ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_rows           ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log             ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE eight_ball_race_chart ENABLE ROW LEVEL SECURITY;
ALTER TABLE nine_ball_point_targets ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PROFILES
-- ============================================================
-- Users can read their own profile.
CREATE POLICY profiles_select_own ON profiles
  FOR SELECT USING (id = auth.uid());

-- Admins can read all profiles.
CREATE POLICY profiles_select_admin ON profiles
  FOR SELECT USING (get_user_role() = 'admin');

-- Users can update their own profile (display_name, etc.).
CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE USING (id = auth.uid());

-- Admins can update any profile (role assignment, team assignment).
CREATE POLICY profiles_update_admin ON profiles
  FOR UPDATE USING (get_user_role() = 'admin');

-- ============================================================
-- LEAGUES
-- ============================================================
CREATE POLICY leagues_select_all ON leagues
  FOR SELECT USING (true);  -- All authenticated users can view leagues.

CREATE POLICY leagues_insert_admin ON leagues
  FOR INSERT WITH CHECK (get_user_role() = 'admin');

CREATE POLICY leagues_update_admin ON leagues
  FOR UPDATE USING (get_user_role() = 'admin');

CREATE POLICY leagues_delete_admin ON leagues
  FOR DELETE USING (get_user_role() = 'admin');

-- ============================================================
-- DIVISIONS
-- ============================================================
-- Admins see all; team users see divisions in their league/team context.
CREATE POLICY divisions_select_all ON divisions
  FOR SELECT USING (true);

CREATE POLICY divisions_insert_admin ON divisions
  FOR INSERT WITH CHECK (get_user_role() = 'admin');

CREATE POLICY divisions_update_admin ON divisions
  FOR UPDATE USING (get_user_role() = 'admin');

CREATE POLICY divisions_delete_admin ON divisions
  FOR DELETE USING (get_user_role() = 'admin');

-- ============================================================
-- TEAMS
-- ============================================================
-- Admins can see all teams; team users can see their own team.
CREATE POLICY teams_select_admin ON teams
  FOR SELECT USING (get_user_role() = 'admin');

CREATE POLICY teams_select_own ON teams
  FOR SELECT USING (id = get_user_team_id());

CREATE POLICY teams_insert_admin ON teams
  FOR INSERT WITH CHECK (get_user_role() = 'admin');

CREATE POLICY teams_update_admin ON teams
  FOR UPDATE USING (get_user_role() = 'admin');

CREATE POLICY teams_delete_admin ON teams
  FOR DELETE USING (get_user_role() = 'admin');

-- ============================================================
-- PLAYERS
-- ============================================================
CREATE POLICY players_select_admin ON players
  FOR SELECT USING (get_user_role() = 'admin');

-- Team users can read players on their roster.
CREATE POLICY players_select_team ON players
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_players tp
      WHERE tp.player_id = players.id
        AND tp.team_id = get_user_team_id()
    )
  );

CREATE POLICY players_insert_admin ON players
  FOR INSERT WITH CHECK (get_user_role() = 'admin');

CREATE POLICY players_update_admin ON players
  FOR UPDATE USING (get_user_role() = 'admin');

CREATE POLICY players_delete_admin ON players
  FOR DELETE USING (get_user_role() = 'admin');

-- ============================================================
-- TEAM_PLAYERS
-- ============================================================
CREATE POLICY team_players_select_admin ON team_players
  FOR SELECT USING (get_user_role() = 'admin');

CREATE POLICY team_players_select_own ON team_players
  FOR SELECT USING (team_id = get_user_team_id());

CREATE POLICY team_players_insert_admin ON team_players
  FOR INSERT WITH CHECK (get_user_role() = 'admin');

CREATE POLICY team_players_update_admin ON team_players
  FOR UPDATE USING (get_user_role() = 'admin');

CREATE POLICY team_players_delete_admin ON team_players
  FOR DELETE USING (get_user_role() = 'admin');

-- ============================================================
-- SKILL_LEVEL_HISTORY
-- ============================================================
CREATE POLICY skill_level_history_select_admin ON skill_level_history
  FOR SELECT USING (get_user_role() = 'admin');

CREATE POLICY skill_level_history_select_team ON skill_level_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_players tp
      WHERE tp.player_id = skill_level_history.player_id
        AND tp.team_id = get_user_team_id()
    )
  );

CREATE POLICY skill_level_history_insert_admin ON skill_level_history
  FOR INSERT WITH CHECK (get_user_role() = 'admin');

CREATE POLICY skill_level_history_update_admin ON skill_level_history
  FOR UPDATE USING (get_user_role() = 'admin');

CREATE POLICY skill_level_history_delete_admin ON skill_level_history
  FOR DELETE USING (get_user_role() = 'admin');

-- ============================================================
-- TEAM_MATCHES
-- ============================================================
CREATE POLICY team_matches_select_admin ON team_matches
  FOR SELECT USING (get_user_role() = 'admin');

-- Team users can see matches involving their team.
CREATE POLICY team_matches_select_team ON team_matches
  FOR SELECT USING (
    home_team_id = get_user_team_id() OR away_team_id = get_user_team_id()
  );

CREATE POLICY team_matches_insert_admin ON team_matches
  FOR INSERT WITH CHECK (get_user_role() = 'admin');

-- Admins can update any match; teams can update their own matches (for scoring).
CREATE POLICY team_matches_update_admin ON team_matches
  FOR UPDATE USING (get_user_role() = 'admin');

CREATE POLICY team_matches_update_team ON team_matches
  FOR UPDATE USING (
    home_team_id = get_user_team_id() OR away_team_id = get_user_team_id()
  );

CREATE POLICY team_matches_delete_admin ON team_matches
  FOR DELETE USING (get_user_role() = 'admin');

-- ============================================================
-- LINEUPS
-- ============================================================
CREATE POLICY lineups_select_admin ON lineups
  FOR SELECT USING (get_user_role() = 'admin');

CREATE POLICY lineups_select_team ON lineups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_matches tm
      WHERE tm.id = lineups.team_match_id
        AND (tm.home_team_id = get_user_team_id() OR tm.away_team_id = get_user_team_id())
    )
  );

CREATE POLICY lineups_insert_admin ON lineups
  FOR INSERT WITH CHECK (get_user_role() = 'admin');

CREATE POLICY lineups_insert_team ON lineups
  FOR INSERT WITH CHECK (team_id = get_user_team_id());

CREATE POLICY lineups_update_admin ON lineups
  FOR UPDATE USING (get_user_role() = 'admin');

CREATE POLICY lineups_update_team ON lineups
  FOR UPDATE USING (team_id = get_user_team_id());

CREATE POLICY lineups_delete_admin ON lineups
  FOR DELETE USING (get_user_role() = 'admin');

-- ============================================================
-- INDIVIDUAL_MATCHES
-- ============================================================
CREATE POLICY individual_matches_select_admin ON individual_matches
  FOR SELECT USING (get_user_role() = 'admin');

CREATE POLICY individual_matches_select_team ON individual_matches
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_matches tm
      WHERE tm.id = individual_matches.team_match_id
        AND (tm.home_team_id = get_user_team_id() OR tm.away_team_id = get_user_team_id())
    )
  );

CREATE POLICY individual_matches_insert_admin ON individual_matches
  FOR INSERT WITH CHECK (get_user_role() = 'admin');

CREATE POLICY individual_matches_insert_team ON individual_matches
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_matches tm
      WHERE tm.id = individual_matches.team_match_id
        AND (tm.home_team_id = get_user_team_id() OR tm.away_team_id = get_user_team_id())
    )
  );

CREATE POLICY individual_matches_update_admin ON individual_matches
  FOR UPDATE USING (get_user_role() = 'admin');

CREATE POLICY individual_matches_update_team ON individual_matches
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM team_matches tm
      WHERE tm.id = individual_matches.team_match_id
        AND (tm.home_team_id = get_user_team_id() OR tm.away_team_id = get_user_team_id())
    )
  );

CREATE POLICY individual_matches_delete_admin ON individual_matches
  FOR DELETE USING (get_user_role() = 'admin');

-- ============================================================
-- RACKS_EIGHT_BALL
-- ============================================================
CREATE POLICY racks_eight_ball_select_admin ON racks_eight_ball
  FOR SELECT USING (get_user_role() = 'admin');

CREATE POLICY racks_eight_ball_select_team ON racks_eight_ball
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM individual_matches im
      JOIN team_matches tm ON tm.id = im.team_match_id
      WHERE im.id = racks_eight_ball.individual_match_id
        AND (tm.home_team_id = get_user_team_id() OR tm.away_team_id = get_user_team_id())
    )
  );

CREATE POLICY racks_eight_ball_insert_admin ON racks_eight_ball
  FOR INSERT WITH CHECK (get_user_role() = 'admin');

CREATE POLICY racks_eight_ball_insert_team ON racks_eight_ball
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM individual_matches im
      JOIN team_matches tm ON tm.id = im.team_match_id
      WHERE im.id = racks_eight_ball.individual_match_id
        AND (tm.home_team_id = get_user_team_id() OR tm.away_team_id = get_user_team_id())
    )
  );

CREATE POLICY racks_eight_ball_update_admin ON racks_eight_ball
  FOR UPDATE USING (get_user_role() = 'admin');

CREATE POLICY racks_eight_ball_update_team ON racks_eight_ball
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM individual_matches im
      JOIN team_matches tm ON tm.id = im.team_match_id
      WHERE im.id = racks_eight_ball.individual_match_id
        AND (tm.home_team_id = get_user_team_id() OR tm.away_team_id = get_user_team_id())
    )
  );

CREATE POLICY racks_eight_ball_delete_admin ON racks_eight_ball
  FOR DELETE USING (get_user_role() = 'admin');

-- ============================================================
-- RACKS_NINE_BALL
-- ============================================================
CREATE POLICY racks_nine_ball_select_admin ON racks_nine_ball
  FOR SELECT USING (get_user_role() = 'admin');

CREATE POLICY racks_nine_ball_select_team ON racks_nine_ball
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM individual_matches im
      JOIN team_matches tm ON tm.id = im.team_match_id
      WHERE im.id = racks_nine_ball.individual_match_id
        AND (tm.home_team_id = get_user_team_id() OR tm.away_team_id = get_user_team_id())
    )
  );

CREATE POLICY racks_nine_ball_insert_admin ON racks_nine_ball
  FOR INSERT WITH CHECK (get_user_role() = 'admin');

CREATE POLICY racks_nine_ball_insert_team ON racks_nine_ball
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM individual_matches im
      JOIN team_matches tm ON tm.id = im.team_match_id
      WHERE im.id = racks_nine_ball.individual_match_id
        AND (tm.home_team_id = get_user_team_id() OR tm.away_team_id = get_user_team_id())
    )
  );

CREATE POLICY racks_nine_ball_update_admin ON racks_nine_ball
  FOR UPDATE USING (get_user_role() = 'admin');

CREATE POLICY racks_nine_ball_update_team ON racks_nine_ball
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM individual_matches im
      JOIN team_matches tm ON tm.id = im.team_match_id
      WHERE im.id = racks_nine_ball.individual_match_id
        AND (tm.home_team_id = get_user_team_id() OR tm.away_team_id = get_user_team_id())
    )
  );

CREATE POLICY racks_nine_ball_delete_admin ON racks_nine_ball
  FOR DELETE USING (get_user_role() = 'admin');

-- ============================================================
-- SCORECARD_SESSIONS
-- ============================================================
CREATE POLICY scorecard_sessions_select ON scorecard_sessions
  FOR SELECT USING (true);  -- Anyone can check if a scorecard is locked.

CREATE POLICY scorecard_sessions_insert ON scorecard_sessions
  FOR INSERT WITH CHECK (locked_by = auth.uid());

CREATE POLICY scorecard_sessions_update ON scorecard_sessions
  FOR UPDATE USING (locked_by = auth.uid() OR get_user_role() = 'admin');

CREATE POLICY scorecard_sessions_delete_admin ON scorecard_sessions
  FOR DELETE USING (get_user_role() = 'admin');

-- ============================================================
-- IMPORTS (admin only)
-- ============================================================
CREATE POLICY imports_select_admin ON imports
  FOR SELECT USING (get_user_role() = 'admin');

CREATE POLICY imports_insert_admin ON imports
  FOR INSERT WITH CHECK (get_user_role() = 'admin');

CREATE POLICY imports_update_admin ON imports
  FOR UPDATE USING (get_user_role() = 'admin');

CREATE POLICY imports_delete_admin ON imports
  FOR DELETE USING (get_user_role() = 'admin');

-- ============================================================
-- IMPORT_ROWS (admin only)
-- ============================================================
CREATE POLICY import_rows_select_admin ON import_rows
  FOR SELECT USING (get_user_role() = 'admin');

CREATE POLICY import_rows_insert_admin ON import_rows
  FOR INSERT WITH CHECK (get_user_role() = 'admin');

CREATE POLICY import_rows_update_admin ON import_rows
  FOR UPDATE USING (get_user_role() = 'admin');

CREATE POLICY import_rows_delete_admin ON import_rows
  FOR DELETE USING (get_user_role() = 'admin');

-- ============================================================
-- AUDIT_LOG (append-only: admin can read, insert only, no update/delete for anyone)
-- ============================================================
CREATE POLICY audit_log_select_admin ON audit_log
  FOR SELECT USING (get_user_role() = 'admin');

CREATE POLICY audit_log_insert ON audit_log
  FOR INSERT WITH CHECK (true);  -- Any authenticated user's actions can be logged.

-- No UPDATE or DELETE policies -- combined with REVOKE in migration 00007,
-- this ensures the audit log is truly append-only.

-- ============================================================
-- DISPUTES
-- ============================================================
CREATE POLICY disputes_select_admin ON disputes
  FOR SELECT USING (get_user_role() = 'admin');

-- Team users can read disputes for their matches.
CREATE POLICY disputes_select_team ON disputes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_matches tm
      WHERE tm.id = disputes.team_match_id
        AND (tm.home_team_id = get_user_team_id() OR tm.away_team_id = get_user_team_id())
    )
  );

-- Team users can create disputes for their matches.
CREATE POLICY disputes_insert_team ON disputes
  FOR INSERT WITH CHECK (
    raised_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM team_matches tm
      WHERE tm.id = disputes.team_match_id
        AND (tm.home_team_id = get_user_team_id() OR tm.away_team_id = get_user_team_id())
    )
  );

CREATE POLICY disputes_insert_admin ON disputes
  FOR INSERT WITH CHECK (get_user_role() = 'admin');

CREATE POLICY disputes_update_admin ON disputes
  FOR UPDATE USING (get_user_role() = 'admin');

CREATE POLICY disputes_delete_admin ON disputes
  FOR DELETE USING (get_user_role() = 'admin');

-- ============================================================
-- REFERENCE DATA (read-only for all authenticated users)
-- ============================================================
CREATE POLICY eight_ball_race_chart_select ON eight_ball_race_chart
  FOR SELECT USING (true);

CREATE POLICY nine_ball_point_targets_select ON nine_ball_point_targets
  FOR SELECT USING (true);
