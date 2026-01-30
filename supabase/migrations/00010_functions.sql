-- Migration 00010: Database Functions
-- Creates server-side functions for scorecard locking, match finalization, and helper utilities.

-- ============================================================
-- 1. get_user_role() - Returns the role of the current user.
-- ============================================================
-- Already created in 00009_rls_policies.sql, but we CREATE OR REPLACE here for completeness.
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- ============================================================
-- 2. get_user_team_id() - Returns the team_id of the current user.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_team_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_id FROM profiles WHERE id = auth.uid();
$$;

-- ============================================================
-- 3. lock_scorecard(p_team_match_id uuid)
--    Atomically locks a scorecard for the current user.
--    - If no active lock exists, creates one.
--    - If a stale lock exists (heartbeat > 5 min ago), reclaims it.
--    - If another user holds a fresh lock, raises an exception.
--    Returns the scorecard_sessions row.
-- ============================================================
CREATE OR REPLACE FUNCTION public.lock_scorecard(p_team_match_id uuid)
RETURNS scorecard_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user uuid := auth.uid();
  v_session      scorecard_sessions;
  v_stale_cutoff timestamptz := now() - interval '5 minutes';
BEGIN
  IF v_current_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Try to find an existing session for this match.
  SELECT * INTO v_session
  FROM scorecard_sessions
  WHERE team_match_id = p_team_match_id
    AND is_active = true
  FOR UPDATE;  -- Lock the row to prevent races.

  IF v_session IS NULL THEN
    -- No active session exists; create one.
    INSERT INTO scorecard_sessions (team_match_id, locked_by, locked_at, last_heartbeat, is_active)
    VALUES (p_team_match_id, v_current_user, now(), now(), true)
    RETURNING * INTO v_session;

    -- Log the lock action.
    INSERT INTO audit_log (actor_id, action, table_name, record_id, new_values)
    VALUES (v_current_user, 'lock', 'scorecard_sessions', v_session.id,
            jsonb_build_object('team_match_id', p_team_match_id));

    RETURN v_session;
  END IF;

  -- Session exists. Check ownership.
  IF v_session.locked_by = v_current_user THEN
    -- Already locked by this user; refresh heartbeat.
    UPDATE scorecard_sessions
    SET last_heartbeat = now(), locked_at = now()
    WHERE id = v_session.id
    RETURNING * INTO v_session;

    RETURN v_session;
  END IF;

  -- Locked by another user. Check staleness.
  IF v_session.last_heartbeat < v_stale_cutoff THEN
    -- Stale lock; reclaim it.
    UPDATE scorecard_sessions
    SET locked_by = v_current_user,
        locked_at = now(),
        last_heartbeat = now()
    WHERE id = v_session.id
    RETURNING * INTO v_session;

    INSERT INTO audit_log (actor_id, action, table_name, record_id, new_values, metadata)
    VALUES (v_current_user, 'lock', 'scorecard_sessions', v_session.id,
            jsonb_build_object('team_match_id', p_team_match_id),
            jsonb_build_object('reclaimed_from_stale', true));

    RETURN v_session;
  END IF;

  -- Another user holds a fresh lock.
  RAISE EXCEPTION 'Scorecard is currently locked by another user'
    USING HINT = 'Try again later or wait for the lock to expire.';
END;
$$;

-- ============================================================
-- 4. heartbeat_scorecard(p_team_match_id uuid)
--    Updates the heartbeat timestamp for the current user's lock.
-- ============================================================
CREATE OR REPLACE FUNCTION public.heartbeat_scorecard(p_team_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user uuid := auth.uid();
  v_updated      boolean;
BEGIN
  IF v_current_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE scorecard_sessions
  SET last_heartbeat = now()
  WHERE team_match_id = p_team_match_id
    AND locked_by = v_current_user
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active lock found for this user on the specified match'
      USING HINT = 'You may need to acquire a lock first.';
  END IF;
END;
$$;

-- ============================================================
-- 5. unlock_scorecard(p_team_match_id uuid)
--    Releases the lock for the current user.
-- ============================================================
CREATE OR REPLACE FUNCTION public.unlock_scorecard(p_team_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user uuid := auth.uid();
  v_session_id   uuid;
BEGIN
  IF v_current_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE scorecard_sessions
  SET is_active = false,
      locked_by = NULL,
      locked_at = NULL,
      last_heartbeat = NULL
  WHERE team_match_id = p_team_match_id
    AND locked_by = v_current_user
    AND is_active = true
  RETURNING id INTO v_session_id;

  IF v_session_id IS NULL THEN
    RAISE EXCEPTION 'No active lock found for this user on the specified match';
  END IF;

  -- Log the unlock action.
  INSERT INTO audit_log (actor_id, action, table_name, record_id, new_values)
  VALUES (v_current_user, 'unlock', 'scorecard_sessions', v_session_id,
          jsonb_build_object('team_match_id', p_team_match_id));
END;
$$;

-- ============================================================
-- 6. finalize_team_match(p_team_match_id uuid, p_home_points int, p_away_points int)
--    Marks a team match as finalized, records final point totals, and creates an audit entry.
-- ============================================================
CREATE OR REPLACE FUNCTION public.finalize_team_match(
  p_team_match_id uuid,
  p_home_points   integer,
  p_away_points   integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user uuid := auth.uid();
  v_old_values   jsonb;
BEGIN
  IF v_current_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Capture old values for audit.
  SELECT jsonb_build_object(
    'match_status', match_status,
    'is_finalized', is_finalized,
    'home_points', home_points,
    'away_points', away_points
  ) INTO v_old_values
  FROM team_matches
  WHERE id = p_team_match_id;

  IF v_old_values IS NULL THEN
    RAISE EXCEPTION 'Team match not found: %', p_team_match_id;
  END IF;

  -- Update the match.
  UPDATE team_matches
  SET is_finalized  = true,
      match_status  = 'finalized',
      home_points   = p_home_points,
      away_points   = p_away_points,
      finalized_at  = now(),
      finalized_by  = v_current_user
  WHERE id = p_team_match_id;

  -- Audit log entry.
  INSERT INTO audit_log (actor_id, action, table_name, record_id, old_values, new_values)
  VALUES (
    v_current_user,
    'finalize',
    'team_matches',
    p_team_match_id,
    v_old_values,
    jsonb_build_object(
      'match_status', 'finalized',
      'is_finalized', true,
      'home_points', p_home_points,
      'away_points', p_away_points,
      'finalized_at', now(),
      'finalized_by', v_current_user
    )
  );
END;
$$;

-- ============================================================
-- 7. reopen_team_match(p_team_match_id uuid, p_reason text)
--    Admin-only function to reopen a finalized match.
--    Sets is_finalized=false, match_status='in_progress', increments offline_version.
-- ============================================================
CREATE OR REPLACE FUNCTION public.reopen_team_match(
  p_team_match_id uuid,
  p_reason        text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user uuid := auth.uid();
  v_role         user_role;
  v_old_values   jsonb;
  v_new_version  integer;
BEGIN
  IF v_current_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Only admins can reopen matches.
  SELECT role INTO v_role FROM profiles WHERE id = v_current_user;
  IF v_role IS NULL OR v_role != 'admin' THEN
    RAISE EXCEPTION 'Only administrators can reopen finalized matches';
  END IF;

  -- Capture old values for audit.
  SELECT jsonb_build_object(
    'match_status', match_status,
    'is_finalized', is_finalized,
    'offline_version', offline_version,
    'home_points', home_points,
    'away_points', away_points
  ) INTO v_old_values
  FROM team_matches
  WHERE id = p_team_match_id;

  IF v_old_values IS NULL THEN
    RAISE EXCEPTION 'Team match not found: %', p_team_match_id;
  END IF;

  -- Reopen the match.
  UPDATE team_matches
  SET is_finalized    = false,
      match_status    = 'in_progress',
      finalized_at    = NULL,
      finalized_by    = NULL,
      offline_version = offline_version + 1
  WHERE id = p_team_match_id
  RETURNING offline_version INTO v_new_version;

  -- Audit log entry with reason.
  INSERT INTO audit_log (actor_id, action, table_name, record_id, old_values, new_values, reason)
  VALUES (
    v_current_user,
    'reopen',
    'team_matches',
    p_team_match_id,
    v_old_values,
    jsonb_build_object(
      'match_status', 'in_progress',
      'is_finalized', false,
      'offline_version', v_new_version
    ),
    p_reason
  );
END;
$$;
