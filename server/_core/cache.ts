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

  get<T>(key: string): T | undefined {
    const value = cache.get<T>(key);
    if (value !== undefined) {
      this.stats.hits++;
    } else {
      this.stats.misses++;
    }
    return value;
  }

  set<T>(key: string, value: T, ttl?: number): boolean {
    return cache.set(key, value, ttl ?? 300);
  }

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

  delete(key: string): number {
    return cache.del(key);
  }

  deletePattern(pattern: RegExp): number {
    const keys = cache.keys() as string[];
    const keysToDelete = keys.filter((key: string) => pattern.test(key));
    if (keysToDelete.length === 0) return 0;
    keysToDelete.forEach(key => cache.del(key));
    return keysToDelete.length;
  }

  clear(): void {
    cache.flushAll();
    this.stats = { hits: 0, misses: 0 };
  }

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

  resetStats(): void {
    this.stats = { hits: 0, misses: 0 };
  }
}

export const cacheManager = new CacheManager();

/**
 * M-04 FIX: Cache key generators معزولة بـ userId أو role
 * البيانات العامة (sites, roles) تُشارك بين المستخدمين — آمن لأنها للقراءة فقط
 * البيانات الشخصية (ticketStats, reports) معزولة بـ userId
 * البيانات الإدارية (users, assets) معزولة بـ role للتأكد من عدم تسريب بيانات بين الأدوار
 */
export const cacheKeys = {
  // Sites — بيانات عامة مشتركة (آمن)
  sites: () => 'sites:all',
  site: (id: number) => `site:${id}`,
  sitesByName: () => 'sites:byName',

  // Users — معزول بـ role لمنع رؤية مستخدم عادي لقائمة كل المستخدمين
  users: (role?: string) => role ? `users:all:role:${role}` : 'users:all:admin',
  user: (id: number) => `user:${id}`,
  usersByRole: (role: string) => `users:role:${role}`,

  // Roles — بيانات عامة مشتركة (آمن)
  roles: () => 'roles:all',
  role: (id: number) => `role:${id}`,

  // Assets — معزول بـ siteId
  assets: (siteId?: number) => siteId ? `assets:site:${siteId}` : 'assets:all',
  asset: (id: number) => `asset:${id}`,

  // Tickets stats — معزول بـ userId لمنع تسريب إحصائيات مستخدم لآخر
  ticketStats: (userId: number) => `tickets:stats:user:${userId}`,

  // Reports — معزول بـ userId أو role
  technicianReport: (userId: number, month?: string) =>
    month ? `report:technician:${userId}:${month}` : `report:technician:${userId}:all`,
  siteReport: (siteId?: number) => siteId ? `report:site:${siteId}` : 'report:site:all',

  // Purchase Orders — معزول بـ role
  purchaseOrders: (role?: string) => role ? `purchase-orders:role:${role}` : 'purchase-orders:all',
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
