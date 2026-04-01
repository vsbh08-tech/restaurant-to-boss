type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const memoryStorage = new Map<string, string>();

let cachedLocalStorage: Storage | null | undefined;

function resolveLocalStorage() {
  if (cachedLocalStorage !== undefined) {
    return cachedLocalStorage;
  }

  if (typeof window === "undefined") {
    cachedLocalStorage = null;
    return cachedLocalStorage;
  }

  try {
    const storage = window.localStorage;
    const probeKey = "__restaurantos_storage_probe__";
    storage.setItem(probeKey, "1");
    storage.removeItem(probeKey);
    cachedLocalStorage = storage;
  } catch {
    cachedLocalStorage = null;
  }

  return cachedLocalStorage;
}

export const safeLocalStorage: StorageLike = {
  getItem(key) {
    try {
      const storage = resolveLocalStorage();
      return storage ? storage.getItem(key) : (memoryStorage.get(key) ?? null);
    } catch {
      return memoryStorage.get(key) ?? null;
    }
  },
  setItem(key, value) {
    memoryStorage.set(key, value);

    try {
      const storage = resolveLocalStorage();
      storage?.setItem(key, value);
    } catch {
      // Ignore storage failures in embedded previews and keep an in-memory fallback.
    }
  },
  removeItem(key) {
    memoryStorage.delete(key);

    try {
      const storage = resolveLocalStorage();
      storage?.removeItem(key);
    } catch {
      // Ignore storage failures in embedded previews and keep an in-memory fallback.
    }
  },
};
