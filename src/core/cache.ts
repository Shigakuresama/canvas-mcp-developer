/**
 * Memory Cache with TTL
 * Reduces API calls by caching responses
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class MemoryCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();

  // TTL configuration in milliseconds
  static readonly TTL = {
    user: 30 * 60 * 1000,       // 30 min
    courses: 30 * 60 * 1000,    // 30 min
    assignments: 5 * 60 * 1000, // 5 min
    submissions: 5 * 60 * 1000, // 5 min
    modules: 10 * 60 * 1000,    // 10 min
    files: 30 * 60 * 1000,      // 30 min
    discussions: 10 * 60 * 1000, // 10 min
    announcements: 5 * 60 * 1000, // 5 min
    planner: 5 * 60 * 1000,     // 5 min
    grades: 5 * 60 * 1000,      // 5 min
    default: 5 * 60 * 1000,     // 5 min default
  };

  /**
   * Get cached value if not expired
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Set value with TTL
   */
  set<T>(key: string, value: T, ttl?: number): void {
    const effectiveTtl = ttl ?? this.getTtlForKey(key);
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + effectiveTtl,
    });
  }

  /**
   * Invalidate keys matching pattern
   */
  invalidate(pattern: string): number {
    let count = 0;
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }

    return count;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  stats(): { size: number; keys: string[] } {
    // Clean expired entries first
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }

    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Determine TTL based on key pattern
   */
  private getTtlForKey(key: string): number {
    if (key.includes('user') || key.includes('profile')) {
      return MemoryCache.TTL.user;
    }
    if (key.includes('course') && !key.includes('assignment')) {
      return MemoryCache.TTL.courses;
    }
    if (key.includes('assignment')) {
      return MemoryCache.TTL.assignments;
    }
    if (key.includes('submission')) {
      return MemoryCache.TTL.submissions;
    }
    if (key.includes('module')) {
      return MemoryCache.TTL.modules;
    }
    if (key.includes('file') || key.includes('folder')) {
      return MemoryCache.TTL.files;
    }
    if (key.includes('discussion')) {
      return MemoryCache.TTL.discussions;
    }
    if (key.includes('announcement')) {
      return MemoryCache.TTL.announcements;
    }
    if (key.includes('planner') || key.includes('todo')) {
      return MemoryCache.TTL.planner;
    }
    if (key.includes('grade') || key.includes('enrollment')) {
      return MemoryCache.TTL.grades;
    }

    return MemoryCache.TTL.default;
  }
}

// Global cache instance
export const cache = new MemoryCache();
