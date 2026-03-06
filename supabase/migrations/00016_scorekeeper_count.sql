-- Add scorekeeper_count to leagues
-- Controls whether innings are verified by a second device after each rack.
-- 1 = single scorekeeper (default), 2 = two-device innings verification

ALTER TABLE leagues
  ADD COLUMN scorekeeper_count integer NOT NULL DEFAULT 1
  CHECK (scorekeeper_count IN (1, 2));
