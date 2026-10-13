// Only approved public catalog reads belong here; never cache account or order data.
export function createPublicReadCache(ttlMs = 30_000, maxEntries = 100) {
  const entries = new Map<string, { expires: number; value: Promise<unknown> }>();
  return {
    read<T>(key: string, load: () => Promise<T>): Promise<T> {
      // SSR requests must not share module-level data or sessions.
      if (typeof window === "undefined") return load();
      const existing = entries.get(key);
      if (existing && existing.expires > Date.now()) return existing.value as Promise<T>;
      entries.delete(key);
      const value = Promise.resolve().then(load);
      const entry = { expires: Date.now() + ttlMs, value };
      entries.set(key, entry);
      if (entries.size > maxEntries) {
        const oldest = entries.keys().next().value;
        if (oldest !== undefined) entries.delete(oldest);
      }
      void value.catch(() => { if (entries.get(key) === entry) entries.delete(key); });
      return value;
    },
    clear() { entries.clear(); },
  };
}