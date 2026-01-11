interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class Cache {
  private storage: Map<string, CacheItem<any>> = new Map();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes default

  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    this.storage.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  get<T>(key: string): T | null {
    const item = this.storage.get(key);
    if (!item) return null;

    const now = Date.now();
    if (now - item.timestamp > item.ttl) {
      this.storage.delete(key);
      return null;
    }

    return item.data;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  clear(): void {
    this.storage.clear();
  }

  remove(key: string): void {
    this.storage.delete(key);
  }
}

export const cache = new Cache();

// Cache keys
export const CACHE_KEYS = {
  OPPORTUNITIES: 'opportunities',
  OPPORTUNITIES_SIMPLE: 'opportunities_simple',
  USER_DATA: 'user_data',
} as const; 