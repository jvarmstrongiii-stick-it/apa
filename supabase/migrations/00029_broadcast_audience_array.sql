-- Migration 00029: Change broadcasts.audience_type from scalar text to text[]
-- This allows the LO to target the intersection of multiple audience categories
-- (e.g. captains who play 8-ball). Existing rows are wrapped in a single-element array.

ALTER TABLE broadcasts DROP CONSTRAINT broadcasts_audience_type_check;

ALTER TABLE broadcasts
  ALTER COLUMN audience_type TYPE text[]
    USING ARRAY[audience_type],
  ALTER COLUMN audience_type SET DEFAULT ARRAY['all']::text[];

ALTER TABLE broadcasts ADD CONSTRAINT broadcasts_audience_type_check
  CHECK (audience_type <@ ARRAY[
    'all', 'captains_only', 'eight_ball', 'nine_ball', 'masters', 'teams', 'players'
  ]::text[]);
