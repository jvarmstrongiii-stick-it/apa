-- Migration 00003: League Structure
-- Creates leagues, divisions, teams, players, team_players, and skill_level_history tables.

-- ============================================================
-- LEAGUES
-- ============================================================
CREATE TABLE leagues (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  game_format game_format NOT NULL,
  season      text        NOT NULL,  -- e.g. 'Spring', 'Fall'
  year        integer     NOT NULL,
  is_active   boolean     NOT NULL DEFAULT true,
  created_by  uuid        REFERENCES profiles (id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER leagues_updated_at
  BEFORE UPDATE ON leagues
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- DIVISIONS
-- ============================================================
CREATE TABLE divisions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id   uuid        NOT NULL REFERENCES leagues (id) ON DELETE CASCADE,
  name        text        NOT NULL,
  day_of_week integer     NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER divisions_updated_at
  BEFORE UPDATE ON divisions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- TEAMS
-- ============================================================
CREATE TABLE teams (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id uuid        NOT NULL REFERENCES divisions (id) ON DELETE CASCADE,
  name        text        NOT NULL,
  number      text,       -- APA team number
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Now that teams exists, add the FK from profiles.team_id -> teams.id
ALTER TABLE profiles
  ADD CONSTRAINT profiles_team_id_fkey
  FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE SET NULL;

-- ============================================================
-- PLAYERS
-- ============================================================
CREATE TABLE players (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name  text        NOT NULL,
  last_name   text        NOT NULL,
  member_id   text        UNIQUE,  -- APA member ID
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER players_updated_at
  BEFORE UPDATE ON players
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- TEAM_PLAYERS  (roster / junction)
-- ============================================================
CREATE TABLE team_players (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     uuid        NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  player_id   uuid        NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  skill_level integer     NOT NULL CHECK (skill_level BETWEEN 1 AND 9),
  is_active   boolean     NOT NULL DEFAULT true,
  joined_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, player_id)
);

-- ============================================================
-- SKILL_LEVEL_HISTORY
-- ============================================================
CREATE TABLE skill_level_history (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id      uuid        NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  league_id      uuid        NOT NULL REFERENCES leagues (id) ON DELETE CASCADE,
  old_level      integer     NOT NULL,
  new_level      integer     NOT NULL,
  effective_date date        NOT NULL DEFAULT CURRENT_DATE,
  created_at     timestamptz NOT NULL DEFAULT now()
);
