-- Migration 00013: Public read policies for the player login screen
-- The login screen runs before authentication, so unauthenticated users (anon)
-- must be able to read scheduled match data to populate the team picker.

-- Allow public SELECT on scheduled matches only.
-- Existing authenticated policies (admin, team) already cover other statuses.
CREATE POLICY team_matches_select_scheduled_public ON team_matches
  FOR SELECT USING (status = 'scheduled');

-- Allow public SELECT on teams.
-- Team names/numbers are not sensitive; they must be visible before login.
CREATE POLICY teams_select_public ON teams
  FOR SELECT USING (true);
