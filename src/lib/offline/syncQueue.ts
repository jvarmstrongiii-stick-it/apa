import { mmkvStorage } from './storage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MutationType = 'insert' | 'update' | 'upsert' | 'delete';

export interface SyncMutation {
  /** Unique identifier for this queued mutation. */
  id: string;
  /** Supabase table name. */
  table: string;
  /** The kind of database operation. */
  type: MutationType;
  /** Row data to send (insert / update / upsert payloads). */
  data: Record<string, unknown>;
  /** Primary key value of the target row (used for update / delete). */
  primaryKey: string;
  /** Unix epoch ms when the mutation was enqueued. */
  createdAt: number;
  /** Number of times processing has been attempted and failed. */
  retryCount: number;
  /** Human-readable description of the last processing error, if any. */
  lastError?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QUEUE_KEY = 'sync_queue';

// ---------------------------------------------------------------------------
// UUID helper
// ---------------------------------------------------------------------------

/**
 * Generate a v4-style UUID.
 *
 * Prefers the native `crypto.randomUUID()` when available (React Native
 * Hermes >=0.12 / modern JS engines). Falls back to a simple timestamp +
 * random string approach that is sufficiently unique for local queue IDs.
 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Fallback: timestamp hex + random hex segments
  const ts = Date.now().toString(16);
  const rand = () =>
    Math.floor(Math.random() * 0x10000)
      .toString(16)
      .padStart(4, '0');

  return `${ts}-${rand()}-${rand()}-${rand()}`;
}

// ---------------------------------------------------------------------------
// Queue operations
// ---------------------------------------------------------------------------

/** Read the full queue from MMKV. Returns an empty array when nothing stored. */
export function getQueue(): SyncMutation[] {
  return mmkvStorage.getObject<SyncMutation[]>(QUEUE_KEY) ?? [];
}

/** Persist the given queue array back to MMKV. */
function saveQueue(queue: SyncMutation[]): void {
  mmkvStorage.setObject(QUEUE_KEY, queue);
}

/**
 * Append a new mutation to the end of the sync queue.
 *
 * The caller supplies everything except `id`, `createdAt`, and `retryCount`
 * which are filled in automatically.
 *
 * @returns The fully-formed `SyncMutation` that was enqueued.
 */
export function addToQueue(
  mutation: Omit<SyncMutation, 'id' | 'createdAt' | 'retryCount'>,
): SyncMutation {
  const entry: SyncMutation = {
    ...mutation,
    id: generateId(),
    createdAt: Date.now(),
    retryCount: 0,
  };

  const queue = getQueue();
  queue.push(entry);
  saveQueue(queue);

  return entry;
}

/** Remove a single mutation from the queue by its id. */
export function removeFromQueue(id: string): void {
  const queue = getQueue().filter((m) => m.id !== id);
  saveQueue(queue);
}

/** Apply a partial update to an existing mutation (identified by id). */
export function updateMutation(
  id: string,
  updates: Partial<SyncMutation>,
): void {
  const queue = getQueue().map((m) =>
    m.id === id ? { ...m, ...updates } : m,
  );
  saveQueue(queue);
}

/** Remove every mutation from the queue. */
export function clearQueue(): void {
  saveQueue([]);
}

/** Return the current number of pending mutations. */
export function getQueueSize(): number {
  return getQueue().length;
}
