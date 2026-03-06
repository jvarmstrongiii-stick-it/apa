/**
 * Pending score writes — thin wrapper around the generic offline sync queue.
 *
 * When a rack completes offline, `enqueuePendingWrite` stores the result so
 * the scoring screen can navigate away immediately (data is safe in MMKV).
 * `flushPendingWrites` is called whenever the scoring tab gains focus and
 * will attempt to push every queued write to Supabase.
 */

import { addToQueue, processSyncQueue, getQueue } from './offline';

export interface PendingWrite {
  individualMatchId: string;
  teamMatchId: string;
  home: number;
  away: number;
  innings: number;
}

/**
 * Add a rack result to the offline queue.
 * Safe to call when there is no network — data persists in MMKV across restarts.
 */
export function enqueuePendingWrite(w: PendingWrite): void {
  addToQueue({
    table: 'individual_matches',
    type: 'update',
    primaryKey: w.individualMatchId,
    data: {
      racks_home: w.home,
      racks_away: w.away,
      innings: w.innings,
      status: 'completed',
    },
  });
}

/**
 * Attempt to flush every pending score write to Supabase.
 * Successfully synced writes are removed from the queue.
 * Failed writes remain queued for the next flush attempt.
 *
 * @returns Counts of processed and failed mutations.
 */
export async function flushPendingWrites(): Promise<{ processed: number; failed: number }> {
  return processSyncQueue();
}

/**
 * Return the set of individualMatchIds that currently have pending writes.
 * Used to show a "Sync pending" badge on scoring index cards.
 */
export function getPendingMatchIds(): Set<string> {
  const ids = new Set<string>();
  for (const m of getQueue()) {
    if (m.table === 'individual_matches') {
      ids.add(m.primaryKey);
    }
  }
  return ids;
}
