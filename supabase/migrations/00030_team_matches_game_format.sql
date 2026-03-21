-- Migration 00030: Add game_format to team_matches.
-- Denormalized from leagues for simpler queries — the scoring flow needs
-- game_format on every match screen; pulling it through division → league
-- on every query is unnecessary indirection.
-- game_format is NOT NULL with no default: any insert that omits it fails loudly.

ALTER TABLE team_matches ADD COLUMN game_format game_format;

-- Backfill from division → league for all existing rows
UPDATE team_matches tm
SET game_format = l.game_format
FROM divisions d
JOIN leagues l ON l.id = d.league_id
WHERE d.id = tm.division_id;

ALTER TABLE team_matches ALTER COLUMN game_format SET NOT NULL;
