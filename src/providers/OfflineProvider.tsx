import React, { createContext, useContext, type ReactNode } from 'react';
import { useOfflineSync } from '../hooks/useOfflineSync';

// ---------------------------------------------------------------------------
// Context type
// ---------------------------------------------------------------------------

interface OfflineSyncContext {
  /** Whether the device currently has network connectivity. */
  isOnline: boolean;
  /** Whether a sync cycle is currently in progress. */
  isSyncing: boolean;
  /** Number of mutations waiting to be synced. */
  pendingCount: number;
  /** Unix epoch ms of the last successful sync, or null if never synced. */
  lastSyncAt: number | null;
  /** Manually trigger a sync cycle. */
  syncNow: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const OfflineContext = createContext<OfflineSyncContext | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface OfflineProviderProps {
  children: ReactNode;
}

/**
 * Top-level provider that initialises the offline sync system on mount.
 *
 * Wrap your app root with `<OfflineProvider>` to:
 * - Start monitoring network connectivity.
 * - Begin periodic sync queue processing (every 30 s).
 * - Automatically flush the queue when the device comes back online.
 *
 * Descendant components can consume sync state via `useOfflineSyncContext()`.
 */
export function OfflineProvider({ children }: OfflineProviderProps) {
  const sync = useOfflineSync();

  return (
    <OfflineContext.Provider value={sync}>
      {children}
    </OfflineContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Consumer hook
// ---------------------------------------------------------------------------

/**
 * Access the offline sync context from any descendant of `<OfflineProvider>`.
 *
 * Throws if called outside the provider tree (catches integration mistakes
 * early in development).
 */
export function useOfflineSyncContext(): OfflineSyncContext {
  const context = useContext(OfflineContext);

  if (context === null) {
    throw new Error(
      'useOfflineSyncContext must be used within an <OfflineProvider>. ' +
        'Wrap your app root with <OfflineProvider> to enable offline sync.',
    );
  }

  return context;
}
