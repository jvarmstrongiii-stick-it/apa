-- =============================================================================
-- APA Pool League — Truncate All Match & Player Data
-- Preserves: leagues, admin/lo profiles, reference tables (race chart, point targets)
-- Run in the Supabase SQL editor.
--
-- DO NOT use CASCADE — it would wipe the entire profiles table (including
-- admin/lo accounts) because profiles.team_id has a FK to teams.
-- Instead, truncate in strict reverse FK order (children before parents).
--
-- AFTER RUNNING THIS:
--   1. No need to redeploy the edge function — RLS policies and schema
--      are unaffected. Your LO login will still work normally.
--   2. Re-import scoresheets to repopulate divisions, teams, players,
--      and match data.
--   NOTE: If LO login ever stops working after a fresh schema change,
--   re-run supabase/migrations/00021_lo_rls_policies.sql in the SQL editor.
-- =============================================================================

-- 1. Deepest children first
TRUNCATE TABLE racks_eight_ball    RESTART IDENTITY;
TRUNCATE TABLE racks_nine_ball     RESTART IDENTITY;
TRUNCATE TABLE scorecard_sessions  RESTART IDENTITY;
TRUNCATE TABLE disputes            RESTART IDENTITY;
TRUNCATE TABLE audit_log           RESTART IDENTITY;
TRUNCATE TABLE import_rows         RESTART IDENTITY;

-- 2. Mid-level dependents
TRUNCATE TABLE individual_matches  RESTART IDENTITY;
TRUNCATE TABLE lineups             RESTART IDENTITY;
TRUNCATE TABLE skill_level_history RESTART IDENTITY;
TRUNCATE TABLE team_players        RESTART IDENTITY;
TRUNCATE TABLE team_matches        RESTART IDENTITY;
TRUNCATE TABLE imports             RESTART IDENTITY;

-- 3. Remove anonymous team-role profiles before clearing teams/players
--    (admin/lo profiles have no team_id and are left untouched)
DELETE FROM profiles WHERE role = 'team';

-- 4. Root data tables
TRUNCATE TABLE players    RESTART IDENTITY;
TRUNCATE TABLE teams      RESTART IDENTITY;
TRUNCATE TABLE divisions  RESTART IDENTITY;
