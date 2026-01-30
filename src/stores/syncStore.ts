import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandMMKVStorage } from '../lib/offline/storage';
import { processSyncQueue } from '../lib/offline/syncEngine';
import { getQueueSize } from '../lib/offline/syncQueue';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SyncStore {
  /** Whether the device currently has network connectivity. */
  isOnline: boolean;
  /** Whether a sync cycle is currently in progress. */
  isSyncing: boolean;
  /** Unix epoch ms of the last successful sync, or null if never synced. */
  lastSyncAt: number | null;
  /** Number of mutations waiting to be synced. */
  pendingCount: number;
  /** Human-readable description of the last sync error, if any. */
  lastError: string | null;

  // Actions
  setOnline: (online: boolean) => void;
  syncNow: () => Promise<void>;
  updatePendingCount: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useSyncStore = create<SyncStore>()(
  persist(
    (set, get) => ({
      // -- Initial state ----------------------------------------------------
      isOnline: true,
      isSyncing: false,
      lastSyncAt: null,
      pendingCount: 0,
      lastError: null,

      // -- Actions ----------------------------------------------------------

      setOnline: (online: boolean) => {
        set({ isOnline: online });
      },

      syncNow: async () => {
        const state = get();

        // Guard: don't start a sync if we're offline or already syncing
        if (!state.isOnline || state.isSyncing) return;

        set({ isSyncing: true, lastError: null });

        try {
          const { processed, failed } = await processSyncQueue();

          set({
            isSyncing: false,
            lastSyncAt: processed > 0 ? Date.now() : state.lastSyncAt,
            pendingCount: getQueueSize(),
            lastError:
              failed > 0 ? `${failed} mutation(s) failed to sync` : null,
          });
        } catch (error: unknown) {
          set({
            isSyncing: false,
            pendingCount: getQueueSize(),
            lastError:
              error instanceof Error
                ? error.message
                : 'Sync failed with an unknown error',
          });
        }
      },

      updatePendingCount: () => {
        set({ pendingCount: getQueueSize() });
      },
    }),
    {
      name: 'sync-store',
      storage: createJSONStorage(() => zustandMMKVStorage),
      // Only persist a subset of fields – transient flags like isSyncing
      // should always start fresh.
      partialize: (state) => ({
        lastSyncAt: state.lastSyncAt,
        pendingCount: state.pendingCount,
      }),
    },
  ),
);
