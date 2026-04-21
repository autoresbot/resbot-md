// DONT EDIT
const CACHE_EXPIRATION_TIME = 10 * 60 * 1000; // 10 menit

class Cache {
  constructor(expirationTime) {
    this.cache = new Map();
    this.expirationTime = expirationTime;
  }

  set(id, data) {
    const timestamp = Date.now();
    this.cache.set(id, { data, timestamp });
  }

  get(id) {
    const entry = this.cache.get(id);
    if (entry) {
      const currentTime = Date.now();
      const age = currentTime - entry.timestamp;
      if (age > this.expirationTime) return false;
      return entry;
    }
    return null;
  }

  delete(id) {
    return this.cache.delete(id);
  }

  has(id) {
    return this.cache.has(id);
  }

  clear() {
    this.cache.clear();
  }

  entries() {
    return Array.from(this.cache.entries()).map(([id, value]) => ({
      id,
      data: value.data,
      timestamp: value.timestamp,
    }));
  }

  keys() {
    return Array.from(this.cache.keys());
  }

  size() {
    return this.cache.size;
  }
}

// Instance cache
const myCache = new Cache(CACHE_EXPIRATION_TIME);

// Fungsi helper
function checkCache(id) {
  return myCache.has(id);
}

function getCache(id) {
  return myCache.get(id);
}

function deleteCache(id) {
  return myCache.delete(id);
}

// --- ESM Export ---
export const setCache = myCache.set.bind(myCache);
export const clearCache = myCache.clear.bind(myCache);
export const sizeCache = myCache.size.bind(myCache);
export const entriesCache = myCache.entries.bind(myCache);

export { myCache, checkCache, getCache, deleteCache };
