-- Migration 00004: Match Scheduling & Lineups
-- Creates team_matches and lineups tables for match scheduling and team lineup management.

-- ============================================================
-- TEAM_MATCHES
-- ============================================================
CREATE TABLE team_matches (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id     uuid          NOT NULL REFERENCES divisions (id) ON DELETE CASCADE,
  home_team_id    uuid          NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  away_team_id    uuid          NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  match_date      date          NOT NULL,
  week_number     integer       NOT NULL,
  match_status    match_status  NOT NULL DEFAULT 'scheduled',
  home_points     integer       NOT NULL DEFAULT 0,
  away_points     integer       NOT NULL DEFAULT 0,
  is_finalized    boolean       NOT NULL DEFAULT false,
  finalized_at    timestamptz,
  finalized_by    uuid          REFERENCES profiles (id),
  offline_version integer       NOT NULL DEFAULT 1,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now()
);

CREATE TRIGGER team_matches_updated_at
  BEFORE UPDATE ON team_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- LINEUPS
-- ============================================================
CREATE TABLE lineups (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  team_match_id   uuid    NOT NULL REFERENCES team_matches (id) ON DELETE CASCADE,
  team_id         uuid    NOT NULL REFERENCES teams (id) ON DELETE CASCADE,

  -- Players in lineup slots 1-5
  player_1_id     uuid    REFERENCES players (id),
  player_2_id     uuid    REFERENCES players (id),
  player_3_id     uuid    REFERENCES players (id),
  player_4_id     uuid    REFERENCES players (id),
  player_5_id     uuid    REFERENCES players (id),

  -- Corresponding skill levels
  player_1_skill  integer,
  player_2_skill  integer,
  player_3_skill  integer,
  player_4_skill  integer,
  player_5_skill  integer,

  -- Generated column: sum of all skill levels
  total_skill_level integer GENERATED ALWAYS AS (
    COALESCE(player_1_skill, 0) +
    COALESCE(player_2_skill, 0) +
    COALESCE(player_3_skill, 0) +
    COALESCE(player_4_skill, 0) +
    COALESCE(player_5_skill, 0)
  ) STORED,

  put_up_order    jsonb,
  is_confirmed    boolean     NOT NULL DEFAULT false,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- APA 23-rule: total skill level of a 5-player lineup must not exceed 23
  CONSTRAINT lineups_skill_cap CHECK (
    (COALESCE(player_1_skill, 0) +
     COALESCE(player_2_skill, 0) +
     COALESCE(player_3_skill, 0) +
     COALESCE(player_4_skill, 0) +
     COALESCE(player_5_skill, 0)) <= 23
  )
);

CREATE TRIGGER lineups_updated_at
  BEFORE UPDATE ON lineups
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
