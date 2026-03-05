-- Migration 00022: Add email and league_id fields to profiles for LO accounts
-- email:     stores the LO's login email for password reset flows
-- league_id: links the LO to the league they manage (area name comes from leagues.name)

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email     text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS league_id uuid REFERENCES leagues(id) ON DELETE SET NULL;
