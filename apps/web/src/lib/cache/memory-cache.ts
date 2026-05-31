type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

declare global {
  // Cache local por proceso. En serverless reduce repeticion dentro de la misma instancia.
  // eslint-disable-next-line no-var
  var __projectHubMemoryCache: Map<string, CacheEntry<unknown>> | undefined;
}

const cache = globalThis.__projectHubMemoryCache || new Map<string, CacheEntry<unknown>>();
globalThis.__projectHubMemoryCache = cache;

export function getMemoryCache<T>(key: string): T | null {
  const entry = cache.get(key);

  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }

  return entry.value as T;
}

export function setMemoryCache<T>(key: string, value: T, ttlSeconds: number): void {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

export function deleteMemoryCache(key: string): void {
  cache.delete(key);
}
