-- Migration 00020: Division number
-- Stores the APA division number (e.g. "435") separately from the full
-- division name string. Derived from the first 3 digits of team numbers
-- (e.g. team "43502" → division "435", team "02").

ALTER TABLE divisions ADD COLUMN IF NOT EXISTS division_number text;
