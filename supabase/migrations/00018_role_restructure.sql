-- Migration 00018: Role Restructure
-- Introduces 'lo' (League Operator) as a distinct role from 'admin'.
-- 'admin' is now reserved for the superuser only.
-- 'lo' replaces 'admin' for all current LO users.
-- Also adds 'both' to game_format for combined 8-ball/9-ball leagues.
-- Adds first_name / last_name columns to profiles.

-- Add new enum values
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'lo' AFTER 'team';
ALTER TYPE game_format ADD VALUE IF NOT EXISTS 'both';

-- Add name columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name  text;

-- ============================================================
-- Run these UPDATE statements manually, in order, after the
-- ALTER statements above have been committed.
-- ============================================================

-- Step 1: Migrate all existing LO users from 'admin' → 'lo'
-- (The 'admin' role is now reserved for the superuser.)
-- UPDATE profiles SET role = 'lo' WHERE role = 'admin';

-- Step 2: Set up the superuser account
-- UPDATE profiles
--   SET role = 'admin',
--       first_name = 'John',
--       last_name = 'Armstrong',
--       display_name = 'John Armstrong'
--   WHERE id = (SELECT id FROM auth.users WHERE email = 'jvarmstrongiii@gmail.com');
