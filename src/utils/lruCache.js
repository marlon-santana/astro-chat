class LRUCache {
  constructor() {
    this.map = new Map();
  }

  get(key) {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return null;
    }
    // refresh order
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key, value, ttlMs = 600000) {
    const expiresAt = ttlMs > 0 ? Date.now() + ttlMs : null;
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expiresAt });
    // keep map size reasonable (max 1000)
    if (this.map.size > 1000) {
      const firstKey = this.map.keys().next().value;
      this.map.delete(firstKey);
    }
  }
}

module.exports = new LRUCache();
