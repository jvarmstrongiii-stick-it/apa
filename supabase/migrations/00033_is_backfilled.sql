-- Migration 00033: Add is_backfilled flag to individual_matches
-- Marks matches that were entered from the paper scoresheet (mid-session start)
-- vs matches scored live through the app.

ALTER TABLE individual_matches
  ADD COLUMN IF NOT EXISTS is_backfilled boolean NOT NULL DEFAULT false;
