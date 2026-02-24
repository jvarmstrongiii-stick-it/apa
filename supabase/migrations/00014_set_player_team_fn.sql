-- Migration 00014: set_player_team RPC function
--
-- Called immediately after anonymous sign-in on the player login screen.
-- Creates (or updates) the caller's profile row with role='team' and the
-- chosen team_id.  SECURITY DEFINER bypasses RLS so an anon user can
-- upsert their own profile without a client-side INSERT policy.

CREATE OR REPLACE FUNCTION public.set_player_team(p_team_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO profiles (id, role, team_id)
  VALUES (auth.uid(), 'team', p_team_id)
  ON CONFLICT (id) DO UPDATE
    SET team_id    = EXCLUDED.team_id,
        role       = 'team',
        updated_at = now();
$$;
