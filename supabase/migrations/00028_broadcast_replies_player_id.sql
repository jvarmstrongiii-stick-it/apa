-- Add player_id to broadcast_replies for session-persistent vote tracking.
-- Votes are currently keyed by user_id (anonymous session), which resets on
-- every cold launch. Storing player_id allows the dashboard to find existing
-- votes across sessions using the player's persistent roster identity.

ALTER TABLE broadcast_replies
  ADD COLUMN player_id uuid REFERENCES players(id);

-- Partial unique: one vote per player per broadcast (enforced across sessions)
CREATE UNIQUE INDEX broadcast_replies_player_id_unique
  ON broadcast_replies (broadcast_id, player_id)
  WHERE player_id IS NOT NULL;

-- Update SELECT policy to also allow reads where player_id matches current user's profile
DROP POLICY "own_read_replies" ON broadcast_replies;
CREATE POLICY "own_read_replies"
  ON broadcast_replies FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.player_id IS NOT NULL
        AND p.player_id = broadcast_replies.player_id
    )
  );
