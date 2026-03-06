-- Add innings verification columns to individual_matches
-- Used for two-device innings verification (scorekeeper_count = 2).
-- Both columns are NULL when no verification is active.
-- Cleared back to NULL once both scorekeepers agree and the rack advances.

ALTER TABLE individual_matches
  ADD COLUMN innings_verify_home integer,   -- primary scorer's submitted inning count
  ADD COLUMN innings_verify_away integer;   -- secondary scorer's submitted inning count
