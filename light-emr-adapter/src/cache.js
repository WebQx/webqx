const store = new Map();

export function setCache(key, value, ttlMs) {
  store.set(key, { value, expires: Date.now() + ttlMs });
}

export function getCache(key) {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expires) { store.delete(key); return undefined; }
  return entry.value;
}
