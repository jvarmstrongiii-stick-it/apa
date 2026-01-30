import { supabase } from '../supabase/client';
import {
  getQueue,
  removeFromQueue,
  updateMutation,
  type SyncMutation,
} from './syncQueue';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Maximum number of retry attempts before a mutation is considered
 * permanently failed and skipped during queue processing.
 */
const MAX_RETRIES = 5;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Walk through every pending mutation in the sync queue and attempt to push
 * it to Supabase.
 *
 * - Successfully synced mutations are removed from the queue.
 * - Failed mutations have their `retryCount` incremented and the error
 *   message recorded. They remain in the queue for a future attempt.
 * - Mutations that have already exceeded `MAX_RETRIES` are counted as
 *   failed and left untouched (they can be inspected / purged by the UI).
 *
 * @returns A summary of how many mutations were processed vs failed.
 */
export async function processSyncQueue(): Promise<{
  processed: number;
  failed: number;
}> {
  const queue = getQueue();
  let processed = 0;
  let failed = 0;

  for (const mutation of queue) {
    if (mutation.retryCount >= MAX_RETRIES) {
      failed++;
      continue;
    }

    try {
      await executeMutation(mutation);
      removeFromQueue(mutation.id);
      processed++;
    } catch (error: unknown) {
      updateMutation(mutation.id, {
        retryCount: mutation.retryCount + 1,
        lastError:
          error instanceof Error ? error.message : 'Unknown error',
      });
      failed++;
    }
  }

  return { processed, failed };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Execute a single mutation against Supabase.
 *
 * Throws on any Supabase error so that the caller can handle retries.
 */
async function executeMutation(mutation: SyncMutation): Promise<void> {
  const { table, type, data, primaryKey } = mutation;

  switch (type) {
    case 'insert': {
      const { error } = await supabase.from(table).insert(data);
      if (error) throw error;
      break;
    }
    case 'update': {
      const { error } = await supabase
        .from(table)
        .update(data)
        .eq('id', primaryKey);
      if (error) throw error;
      break;
    }
    case 'upsert': {
      const { error } = await supabase.from(table).upsert(data);
      if (error) throw error;
      break;
    }
    case 'delete': {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', primaryKey);
      if (error) throw error;
      break;
    }
    default: {
      // Exhaustiveness guard – should never be reached.
      const _exhaustive: never = type;
      throw new Error(`Unknown mutation type: ${_exhaustive}`);
    }
  }
}
