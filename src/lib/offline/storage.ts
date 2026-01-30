// ---------------------------------------------------------------------------
// MMKV Instance (with Expo Go fallback)
// ---------------------------------------------------------------------------
// react-native-mmkv requires native modules (NitroModules) which are not
// available in Expo Go. We attempt to instantiate MMKV and, if it fails,
// fall back to a simple in-memory Map that exposes the same interface.
// This lets the app run in Expo Go for development while still using MMKV
// in production builds.
// ---------------------------------------------------------------------------

interface MMKVLike {
  getString(key: string): string | undefined;
  getNumber(key: string): number | undefined;
  getBoolean(key: string): boolean | undefined;
  set(key: string, value: string | number | boolean): void;
  delete(key: string): void;
  clearAll(): void;
}

function createStorage(): MMKVLike {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { MMKV } = require('react-native-mmkv');
    return new MMKV({ id: 'apa-league-storage' });
  } catch {
    // Fallback: in-memory storage for Expo Go / web
    console.warn(
      '[storage] react-native-mmkv not available — using in-memory fallback. ' +
        'Data will NOT persist across app restarts.',
    );
    const map = new Map<string, string | number | boolean>();
    return {
      getString: (key: string) => {
        const v = map.get(key);
        return typeof v === 'string' ? v : undefined;
      },
      getNumber: (key: string) => {
        const v = map.get(key);
        return typeof v === 'number' ? v : undefined;
      },
      getBoolean: (key: string) => {
        const v = map.get(key);
        return typeof v === 'boolean' ? v : undefined;
      },
      set: (key: string, value: string | number | boolean) => {
        map.set(key, value);
      },
      delete: (key: string) => {
        map.delete(key);
      },
      clearAll: () => {
        map.clear();
      },
    };
  }
}

export const storage: MMKVLike = createStorage();

// ---------------------------------------------------------------------------
// Typed Helpers
// ---------------------------------------------------------------------------

/**
 * Convenience wrapper around the storage instance that provides typed
 * get/set helpers, including JSON serialisation for objects.
 */
export const mmkvStorage = {
  getString: (key: string): string | undefined => storage.getString(key),
  setString: (key: string, value: string): void => {
    storage.set(key, value);
  },

  getNumber: (key: string): number | undefined => storage.getNumber(key),
  setNumber: (key: string, value: number): void => {
    storage.set(key, value);
  },

  getBoolean: (key: string): boolean | undefined => storage.getBoolean(key),
  setBoolean: (key: string, value: boolean): void => {
    storage.set(key, value);
  },

  getObject: <T>(key: string): T | undefined => {
    const str = storage.getString(key);
    if (!str) return undefined;
    try {
      return JSON.parse(str) as T;
    } catch {
      return undefined;
    }
  },
  setObject: <T>(key: string, value: T): void => {
    storage.set(key, JSON.stringify(value));
  },

  delete: (key: string): void => {
    storage.delete(key);
  },
  clearAll: (): void => {
    storage.clearAll();
  },
};

// ---------------------------------------------------------------------------
// Zustand Persist Adapter
// ---------------------------------------------------------------------------

/**
 * A `StateStorage` compatible adapter that allows Zustand's `persist`
 * middleware to use MMKV (or the fallback) as the persistence backend.
 */
export const zustandMMKVStorage = {
  getItem: (name: string): string | null => {
    const value = storage.getString(name);
    return value ?? null;
  },
  setItem: (name: string, value: string): void => {
    storage.set(name, value);
  },
  removeItem: (name: string): void => {
    storage.delete(name);
  },
};
