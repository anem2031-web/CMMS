import NodeCache from 'node-cache';

/**
 * Cache Configuration
 * stdTTL: Standard Time To Live (seconds) - default 5 minutes
 * checkperiod: Automatic delete check interval (seconds) - default 10 seconds
 */
const cache = new NodeCache({ stdTTL: 300, checkperiod: 10 });

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  keys: number;
  memory: number;
}

class CacheManager {
  private stats = {
    hits: 0,
    misses: 0,
  };

  /**
   * Get value from cache
   * @param key - Cache key
   * @returns Cached value or undefined
   */
  get<T>(key: string): T | undefined {
    const value = cache.get<T>(key);
    if (value !== undefined) {
      this.stats.hits++;
    } else {
      this.stats.misses++;
    }
    return value;
  }

  /**
   * Set value in cache
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in seconds (optional)
   */
  set<T>(key: string, value: T, ttl?: number): boolean {
    return cache.set(key, value, ttl ?? 300);
  }

  /**
   * Get or compute value
   * If value exists in cache, return it
   * Otherwise, compute it, cache it, and return it
   * @param key - Cache key
   * @param fn - Function to compute value if not cached
   * @param ttl - Time to live in seconds (optional)
   */
  async getOrCompute<T>(
    key: string,
    fn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await fn();
    this.set(key, value, ttl ?? 300);
    return value;
  }

  /**
   * Delete value from cache
   * @param key - Cache key
   */
  delete(key: string): number {
    return cache.del(key);
  }

  /**
   * Delete multiple keys matching pattern
   * @param pattern - Regex pattern to match keys
   */
  deletePattern(pattern: RegExp): number {
    const keys = cache.keys() as string[];
    const keysToDelete = keys.filter((key: string) => pattern.test(key));
    if (keysToDelete.length === 0) return 0;
    keysToDelete.forEach(key => cache.del(key));
    return keysToDelete.length;
  }

  /**
   * Clear all cache
   */
  clear(): void {
    cache.flushAll();
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const keys = cache.keys() as string[];
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: Math.round(hitRate * 100) / 100,
      keys: keys.length,
      memory: process.memoryUsage().heapUsed,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0 };
  }
}

export const cacheManager = new CacheManager();

/**
 * Cache key generators for common entities
 */
export const cacheKeys = {
  // Sites
  sites: () => 'sites:all',
  site: (id: number) => `site:${id}`,
  sitesByName: () => 'sites:byName',

  // Users
  users: () => 'users:all',
  user: (id: number) => `user:${id}`,
  usersByRole: (role: string) => `users:role:${role}`,

  // Roles
  roles: () => 'roles:all',
  role: (id: number) => `role:${id}`,

  // Assets
  assets: (siteId?: number) => siteId ? `assets:site:${siteId}` : 'assets:all',
  asset: (id: number) => `asset:${id}`,

  // Tickets
  ticketStats: (userId?: number) => userId ? `tickets:stats:${userId}` : 'tickets:stats:all',

  // Reports
  technicianReport: (month?: string) => month ? `report:technician:${month}` : 'report:technician:all',
  siteReport: (siteId?: number) => siteId ? `report:site:${siteId}` : 'report:site:all',

  // Purchase Orders
  purchaseOrders: () => 'purchase-orders:all',
  purchaseOrder: (id: number) => `purchase-order:${id}`,

  // Maintenance Plans
  maintenancePlans: () => 'maintenance-plans:all',
  maintenancePlan: (id: number) => `maintenance-plan:${id}`,

  // Invalidation patterns
  invalidateAll: () => /.*/,
  invalidateSite: (siteId: number) => new RegExp(`site:${siteId}|sites:`),
  invalidateUser: (userId: number) => new RegExp(`user:${userId}|users:`),
  invalidateTickets: () => /tickets:/,
  invalidateReports: () => /report:/,
  invalidatePurchaseOrders: () => /purchase-order/,
};

/**
 * Cache invalidation helper
 * Invalidates cache when data changes
 */
export const invalidateCache = {
  site: (siteId: number) => {
    cacheManager.deletePattern(cacheKeys.invalidateSite(siteId));
  },

  sites: () => {
    cacheManager.deletePattern(/sites:/);
  },

  user: (userId: number) => {
    cacheManager.deletePattern(cacheKeys.invalidateUser(userId));
  },

  users: () => {
    cacheManager.deletePattern(/users:/);
  },

  tickets: () => {
    cacheManager.deletePattern(cacheKeys.invalidateTickets());
  },

  reports: () => {
    cacheManager.deletePattern(cacheKeys.invalidateReports());
  },

  purchaseOrders: () => {
    cacheManager.deletePattern(cacheKeys.invalidatePurchaseOrders());
  },

  all: () => {
    cacheManager.clear();
  },
};
