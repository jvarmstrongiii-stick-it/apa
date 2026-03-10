-- Allow any authenticated user (anonymous team or LO) to read any team's roster.
-- This enables the put-up screen to show both teams' players for matchup decisions.
-- Roster data (name, SL, MP) already appears on paper scoresheets — not sensitive.

CREATE POLICY "authenticated_users_can_read_team_players"
ON team_players FOR SELECT
TO authenticated
USING (true);
