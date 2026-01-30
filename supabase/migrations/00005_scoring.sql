-- Migration 00005: Scoring Tables
-- Creates individual_matches, racks_eight_ball, racks_nine_ball, and scorecard_sessions.

-- ============================================================
-- INDIVIDUAL_MATCHES  (each of the 5 games within a team match)
-- ============================================================
CREATE TABLE individual_matches (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_match_id       uuid        NOT NULL REFERENCES team_matches (id) ON DELETE CASCADE,
  match_order         integer     NOT NULL CHECK (match_order BETWEEN 1 AND 5),
  game_format         game_format NOT NULL,
  home_player_id      uuid        REFERENCES players (id),
  away_player_id      uuid        REFERENCES players (id),
  home_skill_level    integer,
  away_skill_level    integer,
  home_race_to        integer,
  away_race_to        integer,
  home_games_won      integer     NOT NULL DEFAULT 0,
  away_games_won      integer     NOT NULL DEFAULT 0,
  home_points_earned  integer     NOT NULL DEFAULT 0,
  away_points_earned  integer     NOT NULL DEFAULT 0,
  innings             integer     NOT NULL DEFAULT 0,
  defensive_shots     integer     NOT NULL DEFAULT 0,
  is_completed        boolean     NOT NULL DEFAULT false,
  completed_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER individual_matches_updated_at
  BEFORE UPDATE ON individual_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- RACKS_EIGHT_BALL
-- ============================================================
CREATE TABLE racks_eight_ball (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  individual_match_id  uuid        NOT NULL REFERENCES individual_matches (id) ON DELETE CASCADE,
  rack_number          integer     NOT NULL,
  won_by               text        CHECK (won_by IN ('home', 'away') OR won_by IS NULL),
  is_break_and_run     boolean     NOT NULL DEFAULT false,
  is_eight_on_break    boolean     NOT NULL DEFAULT false,
  dead_rack            boolean     NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER racks_eight_ball_updated_at
  BEFORE UPDATE ON racks_eight_ball
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- RACKS_NINE_BALL
-- ============================================================
CREATE TABLE racks_nine_ball (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  individual_match_id  uuid        NOT NULL REFERENCES individual_matches (id) ON DELETE CASCADE,
  rack_number          integer     NOT NULL,
  balls_pocketed_home  jsonb       NOT NULL DEFAULT '[]'::jsonb,
  balls_pocketed_away  jsonb       NOT NULL DEFAULT '[]'::jsonb,
  dead_balls           jsonb       NOT NULL DEFAULT '[]'::jsonb,
  points_home          integer     NOT NULL DEFAULT 0,
  points_away          integer     NOT NULL DEFAULT 0,
  is_break_and_run     boolean     NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER racks_nine_ball_updated_at
  BEFORE UPDATE ON racks_nine_ball
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- SCORECARD_SESSIONS  (pessimistic locking for live scoring)
-- ============================================================
CREATE TABLE scorecard_sessions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_match_id   uuid        NOT NULL UNIQUE REFERENCES team_matches (id) ON DELETE CASCADE,
  locked_by       uuid        REFERENCES auth.users (id),
  locked_at       timestamptz,
  last_heartbeat  timestamptz,
  is_active       boolean     NOT NULL DEFAULT true
);
