/**
 * Redis rate limiter
 * Used to protect API endpoints from brute force and DDoS attacks
 */

import type { Redis } from "ioredis";

// Rate limit configuration
export interface RateLimitConfig {
  /** Time window (seconds) */
  window: number;
  /** Maximum number of requests */
  maxRequests: number;
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  /** Whether request is allowed */
  success: boolean;
  /** Remaining requests */
  remaining: number;
  /** Reset time (Unix timestamp, seconds) */
  resetTime: number;
}

/**
 * Redis rate limiter class
 * Uses sliding window algorithm
 */
export class RedisRateLimiter {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Check if rate limit is exceeded
   * @param key Rate limit key (usually user IP or user ID)
   * @param config Rate limit configuration
   */
  async check(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - config.window;
    const redisKey = `ratelimit:${key}`;

    // Use Redis Pipeline for better performance
    const pipeline = this.redis.pipeline();

    // 1. Delete records outside the window
    pipeline.zremrangebyscore(redisKey, 0, windowStart);

    // 2. Count requests within current window
    pipeline.zcard(redisKey);

    // 3. Add current request
    pipeline.zadd(redisKey, now, `${now}-${Math.random()}`);

    // 4. Set expiration time
    pipeline.expire(redisKey, config.window + 1);

    // Execute all commands
    const results = await pipeline.exec();

    if (!results) {
      throw new Error("Redis pipeline failed");
    }

    // Get current request count (result of second command)
    const currentCount = results[1][1] as number;
    const remaining = Math.max(0, config.maxRequests - currentCount);
    const success = currentCount < config.maxRequests;

    return {
      success,
      remaining,
      resetTime: now + config.window,
    };
  }

  /**
   * Reset rate limit (for testing or admin operations)
   */
  async reset(key: string): Promise<void> {
    await this.redis.del(`ratelimit:${key}`);
  }
}

/**
 * Predefined rate limit configurations
 *
 * Design principles:
 * - Won't affect normal user experience
 * - But can effectively block automated attack scripts
 * - Brute force attacks typically try multiple times per second, we just need to be slower than that
 */
export const RateLimitPresets = {
  /** Login API: 20 requests/minute (normal users unlikely to try 20 times in 1 minute) */
  login: { window: 60, maxRequests: 20 },

  /** Register API: 10 requests/minute (prevent bulk registration, but allow user retries) */
  register: { window: 60, maxRequests: 10 },

  /** Register API (strict): 5 requests/hour (for secondary verification of same email) */
  registerStrict: { window: 3600, maxRequests: 5 },

  /** OAuth API: 20 requests/minute (OAuth callbacks may retry) */
  oauth: { window: 60, maxRequests: 20 },

  /** Password reset: 3 requests/hour (requires stricter limit) */
  passwordReset: { window: 3600, maxRequests: 3 },

  /** Payment API: 5 requests/minute (normal users won't frequently create payment orders) */
  payment: { window: 60, maxRequests: 5 },

  /** Payment API (strict): 10 requests/hour (prevent abuse of payment interface) */
  paymentStrict: { window: 3600, maxRequests: 10 },

  /** Generic API: 100 requests/minute (lenient limit) */
  default: { window: 60, maxRequests: 100 },
} as const;
