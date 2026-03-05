-- Add 'imported' status for team_matches that have been parsed from a PDF
-- but not yet promoted to 'scheduled' by the admin via the staging screen.
-- These matches are invisible to teams (public RLS policy only allows 'scheduled').

ALTER TYPE match_status ADD VALUE IF NOT EXISTS 'imported' BEFORE 'scheduled';
