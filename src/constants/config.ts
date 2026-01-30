/**
 * APA League App - Configuration Constants
 *
 * Contains Supabase connection settings, sync intervals,
 * and APA-specific rule constants.
 */

/** Supabase project URL - replace with your actual project URL */
export const SUPABASE_URL = 'https://wpsxvcjgzibjkttdrgtf.supabase.co';

/** Supabase anonymous/public key - replace with your actual anon key */
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indwc3h2Y2pnemliamt0dGRyZ3RmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3MjM2NDQsImV4cCI6MjA4NTI5OTY0NH0.OI38xpet-OuhsceTd-89BuvAW_4Y0kMaj8OInCsUIrY';

/** How often to sync local changes with the server (ms) */
export const SYNC_INTERVAL_MS = 30000;

/** How often to send a heartbeat to indicate active session (ms) */
export const HEARTBEAT_INTERVAL_MS = 60000;

/**
 * How long before a lock is considered stale and can be overridden (ms).
 * Set to 5 minutes to handle cases where a user loses connection
 * mid-scorekeeping without leaving others permanently locked out.
 */
export const STALE_LOCK_THRESHOLD_MS = 300000;

/**
 * Maximum combined skill level for an APA team lineup.
 * Standard APA 8-Ball rule: 5 players, max total skill level of 23.
 */
export const MAX_TEAM_SKILL_LEVEL = 23;
