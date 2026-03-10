-- rules_flags: stores player-submitted challenges to rules assistant answers
-- prompt_overrides: LO-approved corrections injected into future assistant sessions

CREATE TABLE rules_flags (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  user_id             uuid        REFERENCES auth.users(id),
  question            text        NOT NULL,
  original_answer     text        NOT NULL,
  audit_verdict       text        NOT NULL CHECK (audit_verdict IN ('CONFIRMED','CORRECTED','NUANCE ADDED','ERROR')),
  proposed_correction text,
  status              text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','dismissed'))
);

CREATE TABLE prompt_overrides (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  correction     text        NOT NULL,
  status         text        NOT NULL DEFAULT 'approved' CHECK (status IN ('approved','retired')),
  source_flag_id uuid        REFERENCES rules_flags(id)
);

-- RLS
ALTER TABLE rules_flags     ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_overrides ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can insert their own flags
CREATE POLICY "authenticated_insert_rules_flags"
  ON rules_flags FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- LO and admin can read all flags
CREATE POLICY "lo_read_rules_flags"
  ON rules_flags FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('lo','admin')
  ));

-- LO and admin can update flag status (approve/dismiss)
CREATE POLICY "lo_update_rules_flags"
  ON rules_flags FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('lo','admin')
  ));

-- Any authenticated user can read approved overrides (widget fetches these on open)
CREATE POLICY "read_approved_prompt_overrides"
  ON prompt_overrides FOR SELECT
  TO authenticated
  USING (status = 'approved');

-- LO and admin can insert approved corrections
CREATE POLICY "lo_insert_prompt_overrides"
  ON prompt_overrides FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('lo','admin')
  ));

-- LO and admin can retire overrides
CREATE POLICY "lo_update_prompt_overrides"
  ON prompt_overrides FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('lo','admin')
  ));
