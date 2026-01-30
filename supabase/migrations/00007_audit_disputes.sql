-- Migration 00007: Audit Log & Disputes
-- Creates the append-only audit_log and disputes tables.

-- ============================================================
-- AUDIT_LOG  (append-only: no UPDATE or DELETE allowed)
-- ============================================================
CREATE TABLE audit_log (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid          REFERENCES auth.users (id),
  action      audit_action  NOT NULL,
  table_name  text          NOT NULL,
  record_id   uuid,
  old_values  jsonb,
  new_values  jsonb,
  reason      text,
  metadata    jsonb,
  created_at  timestamptz   NOT NULL DEFAULT now()
);

-- Revoke UPDATE and DELETE on audit_log to enforce append-only semantics.
-- The authenticated and anon roles should never be able to modify or remove audit rows.
REVOKE UPDATE, DELETE ON audit_log FROM public;
REVOKE UPDATE, DELETE ON audit_log FROM authenticated;
REVOKE UPDATE, DELETE ON audit_log FROM anon;

-- ============================================================
-- DISPUTES
-- ============================================================
CREATE TABLE disputes (
  id              uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  team_match_id   uuid            NOT NULL REFERENCES team_matches (id) ON DELETE CASCADE,
  raised_by       uuid            NOT NULL REFERENCES auth.users (id),
  status          dispute_status  NOT NULL DEFAULT 'open',
  description     text            NOT NULL,
  resolution      text,
  resolved_by     uuid            REFERENCES auth.users (id),
  resolved_at     timestamptz,
  created_at      timestamptz     NOT NULL DEFAULT now(),
  updated_at      timestamptz     NOT NULL DEFAULT now()
);

CREATE TRIGGER disputes_updated_at
  BEFORE UPDATE ON disputes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
