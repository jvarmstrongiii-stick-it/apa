-- Migration 00019: Active flags for divisions and teams
-- Adds soft-deactivation support so LOs can hide divisions/teams
-- without deleting imported data.

ALTER TABLE divisions ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE teams     ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
