-- Migration 00001: Enum Types
-- Creates all custom PostgreSQL enum types used throughout the APA League Match Management app.

CREATE TYPE game_format AS ENUM ('eight_ball', 'nine_ball');

CREATE TYPE match_status AS ENUM (
  'scheduled',
  'lineup_set',
  'in_progress',
  'completed',
  'finalized',
  'disputed'
);

CREATE TYPE audit_action AS ENUM (
  'create',
  'update',
  'delete',
  'finalize',
  'reopen',
  'lock',
  'unlock',
  'import',
  'dispute_create',
  'dispute_resolve'
);

CREATE TYPE user_role AS ENUM ('admin', 'team');

CREATE TYPE import_status AS ENUM ('pending', 'processing', 'completed', 'failed');

CREATE TYPE import_row_status AS ENUM ('success', 'error', 'skipped');

CREATE TYPE dispute_status AS ENUM ('open', 'under_review', 'resolved', 'dismissed');
