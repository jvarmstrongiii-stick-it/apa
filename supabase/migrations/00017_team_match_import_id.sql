-- Link team_matches back to the import that created them.
-- ON DELETE SET NULL: if the import record is deleted, the match column
-- becomes null (app code handles explicit cascade for 'imported' status matches).
ALTER TABLE team_matches
  ADD COLUMN IF NOT EXISTS import_id uuid REFERENCES imports(id) ON DELETE SET NULL;
