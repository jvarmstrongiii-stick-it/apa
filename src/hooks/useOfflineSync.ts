import { useEffect, useRef, useCallback } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { useSyncStore } from '../stores/syncStore';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Interval (ms) between automatic sync attempts when online. */
const SYNC_INTERVAL_MS = 30_000;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages the offline-first sync lifecycle:
 *
 * 1. Monitors network connectivity via NetInfo and updates the sync store.
 * 2. Runs a periodic timer (every 30 s) that processes the sync queue when
 *    the device is online.
 * 3. Triggers an immediate sync when connectivity changes from offline to
 *    online.
 *
 * Designed to be called once at the app root (inside `OfflineProvider`).
 *
 * @returns A thin API surface for consumers that need sync status.
 */
export function useOfflineSync() {
  const isOnline = useSyncStore((s) => s.isOnline);
  const isSyncing = useSyncStore((s) => s.isSyncing);
  const pendingCount = useSyncStore((s) => s.pendingCount);
  const lastSyncAt = useSyncStore((s) => s.lastSyncAt);

  const setOnline = useSyncStore((s) => s.setOnline);
  const syncNow = useSyncStore((s) => s.syncNow);
  const updatePendingCount = useSyncStore((s) => s.updatePendingCount);

  // Track the previous online state so we can detect offline -> online.
  const wasOnlineRef = useRef<boolean>(isOnline);

  // ----- Network monitoring ------------------------------------------------

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      setOnline(online);
    });

    return () => {
      unsubscribe();
    };
  }, [setOnline]);

  // ----- Immediate sync on reconnect --------------------------------------

  useEffect(() => {
    if (isOnline && !wasOnlineRef.current) {
      // Just came back online – trigger an immediate sync.
      updatePendingCount();
      void syncNow();
    }
    wasOnlineRef.current = isOnline;
  }, [isOnline, syncNow, updatePendingCount]);

  // ----- Periodic sync timer -----------------------------------------------

  useEffect(() => {
    if (!isOnline) return;

    const intervalId = setInterval(() => {
      updatePendingCount();
      void syncNow();
    }, SYNC_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [isOnline, syncNow, updatePendingCount]);

  // ----- Manual sync trigger -----------------------------------------------

  const triggerSync = useCallback(() => {
    updatePendingCount();
    return syncNow();
  }, [syncNow, updatePendingCount]);

  // ----- Public return value -----------------------------------------------

  return {
    isOnline,
    isSyncing,
    pendingCount,
    lastSyncAt,
    syncNow: triggerSync,
  } as const;
}
