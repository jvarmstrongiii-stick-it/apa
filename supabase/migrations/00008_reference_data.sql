-- Migration 00008: APA Reference Data (Seed)
-- Creates and seeds the 8-ball race chart and 9-ball point target tables.

-- ============================================================
-- EIGHT_BALL_RACE_CHART
-- ============================================================
CREATE TABLE eight_ball_race_chart (
  id             serial  PRIMARY KEY,
  player_skill   integer NOT NULL,
  opponent_skill integer NOT NULL,
  player_race    integer NOT NULL,
  opponent_race  integer NOT NULL,
  UNIQUE (player_skill, opponent_skill)
);

-- Seed: Full APA 8-ball race-to chart (SL 2-7 vs SL 2-7)
--
-- The spec gives each skill level's "race" value against each opponent:
--   SL2 races: vs2=2, vs3=2, vs4=2, vs5=2, vs6=2, vs7=2
--   SL3 races: vs2=3, vs3=2, vs4=2, vs5=2, vs6=2, vs7=2
--   SL4 races: vs2=4, vs3=3, vs4=3, vs5=3, vs6=2, vs7=2
--   SL5 races: vs2=5, vs3=4, vs4=4, vs5=4, vs6=3, vs7=3
--   SL6 races: vs2=6, vs3=5, vs4=5, vs5=5, vs6=4, vs7=4
--   SL7 races: vs2=7, vs3=6, vs4=6, vs5=6, vs6=5, vs7=5
--
-- For a row (P, O), player_race = P's race vs O, opponent_race = O's race vs P.

INSERT INTO eight_ball_race_chart (player_skill, opponent_skill, player_race, opponent_race) VALUES
  -- SL2 as player
  (2, 2, 2, 2),
  (2, 3, 2, 3),
  (2, 4, 2, 4),
  (2, 5, 2, 5),
  (2, 6, 2, 6),
  (2, 7, 2, 7),
  -- SL3 as player
  (3, 2, 3, 2),
  (3, 3, 2, 2),
  (3, 4, 2, 3),
  (3, 5, 2, 4),
  (3, 6, 2, 5),
  (3, 7, 2, 6),
  -- SL4 as player
  (4, 2, 4, 2),
  (4, 3, 3, 2),
  (4, 4, 3, 3),
  (4, 5, 3, 4),
  (4, 6, 2, 5),
  (4, 7, 2, 6),
  -- SL5 as player
  (5, 2, 5, 2),
  (5, 3, 4, 2),
  (5, 4, 4, 3),
  (5, 5, 4, 4),
  (5, 6, 3, 5),
  (5, 7, 3, 6),
  -- SL6 as player
  (6, 2, 6, 2),
  (6, 3, 5, 2),
  (6, 4, 5, 2),
  (6, 5, 5, 3),
  (6, 6, 4, 4),
  (6, 7, 4, 5),
  -- SL7 as player
  (7, 2, 7, 2),
  (7, 3, 6, 2),
  (7, 4, 6, 2),
  (7, 5, 6, 3),
  (7, 6, 5, 4),
  (7, 7, 5, 5);

-- ============================================================
-- NINE_BALL_POINT_TARGETS
-- ============================================================
CREATE TABLE nine_ball_point_targets (
  id              serial  PRIMARY KEY,
  skill_level     integer NOT NULL UNIQUE,
  points_required integer NOT NULL
);

INSERT INTO nine_ball_point_targets (skill_level, points_required) VALUES
  (1, 14),
  (2, 19),
  (3, 25),
  (4, 31),
  (5, 38),
  (6, 46),
  (7, 55),
  (8, 65),
  (9, 75);
