-- =============================================================================
-- APA Pool League — Data Dump
-- Excludes: leagues, admin/lo profiles
-- Run each block in the Supabase SQL editor to view / export data.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. PROFILES (team users only)
-- -----------------------------------------------------------------------------
SELECT
  id,
  role,
  team_id,
  display_name,
  first_name,
  last_name,
  created_at,
  updated_at
FROM profiles
WHERE role = 'team'
ORDER BY last_name, first_name;

-- -----------------------------------------------------------------------------
-- 2. DIVISIONS
-- -----------------------------------------------------------------------------
SELECT
  id,
  league_id,
  division_number,
  name,
  day_of_week,
  location,
  is_active,
  created_at,
  updated_at
FROM divisions
ORDER BY division_number, name;

-- -----------------------------------------------------------------------------
-- 3. TEAMS
-- -----------------------------------------------------------------------------
SELECT
  id,
  division_id,
  team_number,
  name,
  is_active,
  created_at,
  updated_at
FROM teams
ORDER BY team_number, name;

-- -----------------------------------------------------------------------------
-- 4. PLAYERS
-- -----------------------------------------------------------------------------
SELECT
  id,
  member_number,
  first_name,
  last_name,
  skill_level,
  game_format,
  is_active,
  created_at,
  updated_at
FROM players
ORDER BY last_name, first_name;

-- -----------------------------------------------------------------------------
-- 5. TEAM_PLAYERS (roster memberships)
-- -----------------------------------------------------------------------------
SELECT
  id,
  team_id,
  player_id,
  skill_level,
  matches_played,
  is_captain,
  is_active,
  joined_at,
  left_at
FROM team_players
ORDER BY team_id, player_id;

-- -----------------------------------------------------------------------------
-- 6. SKILL_LEVEL_HISTORY
-- -----------------------------------------------------------------------------
SELECT
  id,
  player_id,
  league_id,
  old_level,
  new_level,
  effective_date,
  created_at
FROM skill_level_history
ORDER BY player_id, effective_date;

-- -----------------------------------------------------------------------------
-- 7. TEAM_MATCHES
-- -----------------------------------------------------------------------------
SELECT
  id,
  division_id,
  home_team_id,
  away_team_id,
  match_date,
  week_number,
  status,
  home_score,
  away_score,
  import_id,
  locked_by,
  locked_at,
  finalized_at,
  finalized_by,
  created_at,
  updated_at
FROM team_matches
ORDER BY match_date, week_number;

-- -----------------------------------------------------------------------------
-- 8. LINEUPS
-- -----------------------------------------------------------------------------
SELECT
  id,
  team_match_id,
  team_id,
  player_1_id, player_1_skill,
  player_2_id, player_2_skill,
  player_3_id, player_3_skill,
  player_4_id, player_4_skill,
  player_5_id, player_5_skill,
  total_skill_level,
  put_up_order,
  is_confirmed,
  created_at,
  updated_at
FROM lineups
ORDER BY team_match_id, team_id;

-- -----------------------------------------------------------------------------
-- 9. INDIVIDUAL_MATCHES
-- -----------------------------------------------------------------------------
SELECT
  id,
  team_match_id,
  match_order,
  game_format,
  home_player_id,
  away_player_id,
  home_skill_level,
  away_skill_level,
  home_race_to,
  away_race_to,
  home_games_won,
  away_games_won,
  home_points_earned,
  away_points_earned,
  innings,
  defensive_shots,
  put_up_team,
  is_completed,
  completed_at,
  resumed_at,
  created_at,
  updated_at
FROM individual_matches
ORDER BY team_match_id, match_order;

-- -----------------------------------------------------------------------------
-- 10. RACKS_EIGHT_BALL
-- -----------------------------------------------------------------------------
SELECT
  id,
  individual_match_id,
  rack_number,
  won_by,
  is_break_and_run,
  is_eight_on_break,
  dead_rack,
  innings_home,
  innings_away,
  innings_verified,
  created_at,
  updated_at
FROM racks_eight_ball
ORDER BY individual_match_id, rack_number;

-- -----------------------------------------------------------------------------
-- 11. RACKS_NINE_BALL
-- -----------------------------------------------------------------------------
SELECT
  id,
  individual_match_id,
  rack_number,
  balls_pocketed_home,
  balls_pocketed_away,
  dead_balls,
  points_home,
  points_away,
  is_break_and_run,
  innings_home,
  innings_away,
  innings_verified,
  created_at,
  updated_at
FROM racks_nine_ball
ORDER BY individual_match_id, rack_number;

-- -----------------------------------------------------------------------------
-- 12. SCORECARD_SESSIONS
-- -----------------------------------------------------------------------------
SELECT
  id,
  team_match_id,
  locked_by,
  locked_at,
  last_heartbeat,
  is_active
FROM scorecard_sessions
ORDER BY locked_at;

-- -----------------------------------------------------------------------------
-- 13. IMPORTS
-- -----------------------------------------------------------------------------
SELECT
  id,
  league_id,
  uploaded_by,
  file_name,
  storage_path,
  file_type,
  status,
  total_rows,
  processed_rows,
  error_rows,
  created_at,
  started_at,
  completed_at,
  updated_at
FROM imports
ORDER BY created_at;

-- -----------------------------------------------------------------------------
-- 14. IMPORT_ROWS
-- -----------------------------------------------------------------------------
SELECT
  id,
  import_id,
  row_number,
  status,
  team_match_id,
  raw_data,
  error_message,
  created_at
FROM import_rows
ORDER BY import_id, row_number;

-- -----------------------------------------------------------------------------
-- 15. AUDIT_LOG
-- -----------------------------------------------------------------------------
SELECT
  id,
  actor_id,
  action,
  table_name,
  record_id,
  old_values,
  new_values,
  reason,
  metadata,
  created_at
FROM audit_log
ORDER BY created_at;

-- -----------------------------------------------------------------------------
-- 16. DISPUTES
-- -----------------------------------------------------------------------------
SELECT
  id,
  team_match_id,
  raised_by,
  status,
  description,
  resolution,
  resolved_by,
  resolved_at,
  created_at,
  updated_at
FROM disputes
ORDER BY created_at;

-- -----------------------------------------------------------------------------
-- 17. EIGHT_BALL_RACE_CHART (reference data)
-- -----------------------------------------------------------------------------
SELECT
  id,
  player_skill,
  opponent_skill,
  player_race,
  opponent_race
FROM eight_ball_race_chart
ORDER BY player_skill, opponent_skill;

-- -----------------------------------------------------------------------------
-- 18. NINE_BALL_POINT_TARGETS (reference data)
-- -----------------------------------------------------------------------------
SELECT
  id,
  skill_level,
  points_required
FROM nine_ball_point_targets
ORDER BY skill_level;
