-- Migration 00021: Extend all _admin RLS policies to include 'lo' (League Operator) role
-- Migration 00018 introduced 'lo' role; policies in 00009 only checked 'admin'.
-- Strategy: add is_lo_or_admin() helper, then ALTER POLICY on every _admin policy.

-- Helper: true for both superuser (admin) and league operators (lo)
CREATE OR REPLACE FUNCTION public.is_lo_or_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role IN ('admin', 'lo') FROM profiles WHERE id = auth.uid();
$$;

-- PROFILES
ALTER POLICY profiles_select_admin ON profiles USING (is_lo_or_admin());
ALTER POLICY profiles_update_admin ON profiles USING (is_lo_or_admin());

-- LEAGUES
ALTER POLICY leagues_insert_admin ON leagues WITH CHECK (is_lo_or_admin());
ALTER POLICY leagues_update_admin ON leagues USING (is_lo_or_admin());
ALTER POLICY leagues_delete_admin ON leagues USING (is_lo_or_admin());

-- DIVISIONS
ALTER POLICY divisions_insert_admin ON divisions WITH CHECK (is_lo_or_admin());
ALTER POLICY divisions_update_admin ON divisions USING (is_lo_or_admin());
ALTER POLICY divisions_delete_admin ON divisions USING (is_lo_or_admin());

-- TEAMS
ALTER POLICY teams_select_admin ON teams USING (is_lo_or_admin());
ALTER POLICY teams_insert_admin ON teams WITH CHECK (is_lo_or_admin());
ALTER POLICY teams_update_admin ON teams USING (is_lo_or_admin());
ALTER POLICY teams_delete_admin ON teams USING (is_lo_or_admin());

-- PLAYERS
ALTER POLICY players_select_admin ON players USING (is_lo_or_admin());
ALTER POLICY players_insert_admin ON players WITH CHECK (is_lo_or_admin());
ALTER POLICY players_update_admin ON players USING (is_lo_or_admin());
ALTER POLICY players_delete_admin ON players USING (is_lo_or_admin());

-- TEAM_PLAYERS
ALTER POLICY team_players_select_admin ON team_players USING (is_lo_or_admin());
ALTER POLICY team_players_insert_admin ON team_players WITH CHECK (is_lo_or_admin());
ALTER POLICY team_players_update_admin ON team_players USING (is_lo_or_admin());
ALTER POLICY team_players_delete_admin ON team_players USING (is_lo_or_admin());

-- SKILL_LEVEL_HISTORY
ALTER POLICY skill_level_history_select_admin ON skill_level_history USING (is_lo_or_admin());
ALTER POLICY skill_level_history_insert_admin ON skill_level_history WITH CHECK (is_lo_or_admin());
ALTER POLICY skill_level_history_update_admin ON skill_level_history USING (is_lo_or_admin());
ALTER POLICY skill_level_history_delete_admin ON skill_level_history USING (is_lo_or_admin());

-- TEAM_MATCHES
ALTER POLICY team_matches_select_admin ON team_matches USING (is_lo_or_admin());
ALTER POLICY team_matches_insert_admin ON team_matches WITH CHECK (is_lo_or_admin());
ALTER POLICY team_matches_update_admin ON team_matches USING (is_lo_or_admin());
ALTER POLICY team_matches_delete_admin ON team_matches USING (is_lo_or_admin());

-- LINEUPS
ALTER POLICY lineups_select_admin ON lineups USING (is_lo_or_admin());
ALTER POLICY lineups_insert_admin ON lineups WITH CHECK (is_lo_or_admin());
ALTER POLICY lineups_update_admin ON lineups USING (is_lo_or_admin());
ALTER POLICY lineups_delete_admin ON lineups USING (is_lo_or_admin());

-- INDIVIDUAL_MATCHES
ALTER POLICY individual_matches_select_admin ON individual_matches USING (is_lo_or_admin());
ALTER POLICY individual_matches_insert_admin ON individual_matches WITH CHECK (is_lo_or_admin());
ALTER POLICY individual_matches_update_admin ON individual_matches USING (is_lo_or_admin());
ALTER POLICY individual_matches_delete_admin ON individual_matches USING (is_lo_or_admin());

-- RACKS_EIGHT_BALL
ALTER POLICY racks_eight_ball_select_admin ON racks_eight_ball USING (is_lo_or_admin());
ALTER POLICY racks_eight_ball_insert_admin ON racks_eight_ball WITH CHECK (is_lo_or_admin());
ALTER POLICY racks_eight_ball_update_admin ON racks_eight_ball USING (is_lo_or_admin());
ALTER POLICY racks_eight_ball_delete_admin ON racks_eight_ball USING (is_lo_or_admin());

-- RACKS_NINE_BALL
ALTER POLICY racks_nine_ball_select_admin ON racks_nine_ball USING (is_lo_or_admin());
ALTER POLICY racks_nine_ball_insert_admin ON racks_nine_ball WITH CHECK (is_lo_or_admin());
ALTER POLICY racks_nine_ball_update_admin ON racks_nine_ball USING (is_lo_or_admin());
ALTER POLICY racks_nine_ball_delete_admin ON racks_nine_ball USING (is_lo_or_admin());

-- SCORECARD_SESSIONS
ALTER POLICY scorecard_sessions_update       ON scorecard_sessions USING (locked_by = auth.uid() OR is_lo_or_admin());
ALTER POLICY scorecard_sessions_delete_admin ON scorecard_sessions USING (is_lo_or_admin());

-- IMPORTS
ALTER POLICY imports_select_admin ON imports USING (is_lo_or_admin());
ALTER POLICY imports_insert_admin ON imports WITH CHECK (is_lo_or_admin());
ALTER POLICY imports_update_admin ON imports USING (is_lo_or_admin());
ALTER POLICY imports_delete_admin ON imports USING (is_lo_or_admin());

-- IMPORT_ROWS
ALTER POLICY import_rows_select_admin ON import_rows USING (is_lo_or_admin());
ALTER POLICY import_rows_insert_admin ON import_rows WITH CHECK (is_lo_or_admin());
ALTER POLICY import_rows_update_admin ON import_rows USING (is_lo_or_admin());
ALTER POLICY import_rows_delete_admin ON import_rows USING (is_lo_or_admin());

-- AUDIT_LOG
ALTER POLICY audit_log_select_admin ON audit_log USING (is_lo_or_admin());

-- DISPUTES
ALTER POLICY disputes_select_admin ON disputes USING (is_lo_or_admin());
ALTER POLICY disputes_insert_admin ON disputes WITH CHECK (is_lo_or_admin());
ALTER POLICY disputes_update_admin ON disputes USING (is_lo_or_admin());
ALTER POLICY disputes_delete_admin ON disputes USING (is_lo_or_admin());
