import { Request, Response, NextFunction } from 'express';

/**
 * Smart Rate Limiter
 * - User-ID based limiting for authenticated users (not affected by shared IP)
 * - IP-based limiting for guests
 * - Tiered limits based on user role
 */

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  message: string; // Error message
  keyGenerator?: (req: Request) => string; // Custom key generator
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

// In-memory store for rate limiting
const rateLimitStore: RateLimitStore = {};

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const key in rateLimitStore) {
    if (rateLimitStore[key].resetTime < now) {
      delete rateLimitStore[key];
    }
  }
}, 5 * 60 * 1000);

/**
 * Get client IP address
 * Handles proxies and load balancers
 */
function getClientIp(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
    (req.headers['x-real-ip'] as string) ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

/**
 * Create a rate limiter middleware
 */
export function createRateLimiter(config: RateLimitConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Generate key based on user or IP
    let key: string;

    if (config.keyGenerator) {
      key = config.keyGenerator(req);
    } else if ((req as any).user?.id) {
      // Authenticated user - use user ID
      key = `user:${(req as any).user.id}`;
    } else {
      // Guest - use IP address
      key = `ip:${getClientIp(req)}`;
    }

    const now = Date.now();
    const record = rateLimitStore[key];

    if (!record) {
      // First request in this window
      rateLimitStore[key] = {
        count: 1,
        resetTime: now + config.windowMs,
      };
      return next();
    }

    if (now > record.resetTime) {
      // Window has expired, reset
      rateLimitStore[key] = {
        count: 1,
        resetTime: now + config.windowMs,
      };
      return next();
    }

    // Within window
    record.count++;

    if (record.count > config.maxRequests) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      res.set('Retry-After', retryAfter.toString());
      return res.status(429).json({
        error: 'Too many requests',
        message: config.message,
        retryAfter,
      });
    }

    next();
  };
}

/**
 * Tiered rate limiters based on user role
 */
export const rateLimiters = {
  // Strict limit for login attempts (prevent brute force)
  login: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts per 15 minutes
    message: 'Too many login attempts. Please try again later.',
  }),

  // Moderate limit for 2FA verification
  twoFactorVerify: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10, // 10 attempts per 15 minutes
    message: 'Too many 2FA verification attempts. Please try again later.',
  }),

  // General API limit for authenticated users
  apiUser: createRateLimiter({
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 500, // 500 requests per minute
    message: 'Rate limit exceeded. Please slow down.',
  }),

  // Stricter limit for guests
  apiGuest: createRateLimiter({
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 30, // 30 requests per minute
    message: 'Rate limit exceeded. Please slow down.',
  }),

  // Very strict limit for password reset
  passwordReset: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3, // 3 attempts per hour
    message: 'Too many password reset attempts. Please try again later.',
  }),

  // Strict limit for user creation (prevent spam)
  userCreation: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10, // 10 users per hour per admin
    message: 'Rate limit for user creation exceeded.',
  }),
};

/**
 * Get rate limit statistics for a user
 */
export function getRateLimitStats(userId: string) {
  const key = `user:${userId}`;
  const record = rateLimitStore[key];

  if (!record) {
    return {
      requests: 0,
      limit: 500,
      remaining: 500,
      resetTime: null,
    };
  }

  const now = Date.now();
  if (now > record.resetTime) {
    return {
      requests: 0,
      limit: 500,
      remaining: 500,
      resetTime: null,
    };
  }

  return {
    requests: record.count,
    limit: 500,
    remaining: Math.max(0, 500 - record.count),
    resetTime: new Date(record.resetTime),
  };
}

/**
 * Reset rate limit for a user (admin only)
 */
export function resetRateLimit(userId: string): boolean {
  const key = `user:${userId}`;
  if (rateLimitStore[key]) {
    delete rateLimitStore[key];
    return true;
  }
  return false;
}

/**
 * Clear all rate limits (admin only)
 */
export function clearAllRateLimits(): void {
  for (const key in rateLimitStore) {
    delete rateLimitStore[key];
  }
}

/**
 * Get rate limit store size
 */
export function getRateLimitStoreSize(): number {
  return Object.keys(rateLimitStore).length;
}
