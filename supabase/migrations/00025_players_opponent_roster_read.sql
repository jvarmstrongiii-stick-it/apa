-- Allow reading players on opponent rosters for put-up matchup context.
-- The existing players_select_opponent policy (00015) only covers players already
-- written into individual_matches. This policy covers the full roster browse
-- before a player is selected.
-- Player names, SL, and MP already appear on paper scoresheets — not sensitive.

CREATE POLICY "players_select_opponent_roster"
ON players FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM team_players tp
    WHERE tp.player_id = players.id
      AND EXISTS (
        SELECT 1 FROM team_matches tm
        WHERE (tm.home_team_id = tp.team_id OR tm.away_team_id = tp.team_id)
          AND (tm.home_team_id = get_user_team_id() OR tm.away_team_id = get_user_team_id())
      )
  )
);
