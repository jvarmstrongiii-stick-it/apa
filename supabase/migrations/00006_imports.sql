-- Migration 00006: Imports
-- Creates imports and import_rows tables for CSV/file-based data ingestion.

-- ============================================================
-- IMPORTS
-- ============================================================
CREATE TABLE imports (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id     uuid          NOT NULL REFERENCES leagues (id) ON DELETE CASCADE,
  uploaded_by   uuid          NOT NULL REFERENCES profiles (id),
  file_name     text          NOT NULL,
  storage_path  text          NOT NULL,
  status        import_status NOT NULL DEFAULT 'pending',
  total_rows    integer       NOT NULL DEFAULT 0,
  success_count integer       NOT NULL DEFAULT 0,
  error_count   integer       NOT NULL DEFAULT 0,
  created_at    timestamptz   NOT NULL DEFAULT now(),
  completed_at  timestamptz
);

-- ============================================================
-- IMPORT_ROWS
-- ============================================================
CREATE TABLE import_rows (
  id              uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id       uuid              NOT NULL REFERENCES imports (id) ON DELETE CASCADE,
  row_number      integer           NOT NULL,
  status          import_row_status NOT NULL,
  team_match_id   uuid              REFERENCES team_matches (id) ON DELETE SET NULL,
  raw_data        jsonb             NOT NULL,
  error_message   text,
  created_at      timestamptz       NOT NULL DEFAULT now()
);
