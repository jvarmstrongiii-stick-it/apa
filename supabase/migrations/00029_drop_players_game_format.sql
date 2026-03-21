-- Migration 00029: Drop game_format from players table.
-- Format belongs to the match/league context, not the player record.
-- A player is format-agnostic; current_8_ball_sl / current_9_ball_sl handle dual-format players.

ALTER TABLE players DROP COLUMN game_format;

-- Update RPC: remove game_format from return type (DROP required for return type change)
DROP FUNCTION IF EXISTS public.find_player_by_member_number(text);
CREATE FUNCTION public.find_player_by_member_number(p_member_number text)
RETURNS TABLE (
  id                uuid,
  first_name        text,
  last_name         text,
  member_number     text,
  current_8_ball_sl integer,
  current_9_ball_sl integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, first_name, last_name, member_number,
         current_8_ball_sl, current_9_ball_sl
  FROM players
  WHERE member_number = p_member_number
  LIMIT 1;
$$;
