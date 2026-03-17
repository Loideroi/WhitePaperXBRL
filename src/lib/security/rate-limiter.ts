/**
 * Rate limiter with Upstash Redis backend and in-memory fallback
 *
 * When UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are configured,
 * uses Upstash's sliding window algorithm for distributed rate limiting.
 * Otherwise, falls back to a simple in-memory implementation suitable
 * for local development and single-instance deployments.
 */

import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

// ---------------------------------------------------------------------------
// Shared types (public interface — kept identical to the original)
// ---------------------------------------------------------------------------

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Remaining requests in the current window */
  remaining: number;
  /** Timestamp when the limit resets */
  resetAt: number;
  /** Total limit */
  limit: number;
}

// ---------------------------------------------------------------------------
// In-memory fallback implementation
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/** In-memory store used when Redis is not configured */
const memoryStore = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore.entries()) {
      if (entry.resetAt <= now) {
        memoryStore.delete(key);
      }
    }
  }, 60 * 1000);
}

function checkRateLimitInMemory(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const entry = memoryStore.get(identifier);

  // If no entry or window expired, create new entry
  if (!entry || entry.resetAt <= now) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + config.windowMs,
    };
    memoryStore.set(identifier, newEntry);

    return {
      allowed: true,
      remaining: config.limit - 1,
      resetAt: newEntry.resetAt,
      limit: config.limit,
    };
  }

  // Increment count
  entry.count += 1;

  // Check if over limit
  if (entry.count > config.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      limit: config.limit,
    };
  }

  return {
    allowed: true,
    remaining: config.limit - entry.count,
    resetAt: entry.resetAt,
    limit: config.limit,
  };
}

// ---------------------------------------------------------------------------
// Upstash Redis implementation
// ---------------------------------------------------------------------------

/** Cached Redis client (singleton) */
let redisClient: Redis | null = null;

/** Cache of Ratelimit instances keyed by "limit:windowMs" */
const ratelimitCache = new Map<string, Ratelimit>();

/**
 * Check whether Upstash Redis credentials are available.
 * Reads directly from process.env to avoid circular dependency with env.ts
 * and to support hot-reload of env vars.
 */
function isRedisConfigured(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

/**
 * Get or create the singleton Redis client.
 */
function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return redisClient;
}

/**
 * Get or create a Ratelimit instance for the given config.
 * Upstash Ratelimit instances are reusable and cache-friendly.
 */
function getRatelimiter(config: RateLimitConfig): Ratelimit {
  const key = `${config.limit}:${config.windowMs}`;
  let limiter = ratelimitCache.get(key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: getRedisClient(),
      limiter: Ratelimit.slidingWindow(
        config.limit,
        `${config.windowMs} ms` as Parameters<typeof Ratelimit.slidingWindow>[1]
      ),
      analytics: false,
      prefix: 'wp-xbrl-rl',
    });
    ratelimitCache.set(key, limiter);
  }
  return limiter;
}

async function checkRateLimitRedis(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const limiter = getRatelimiter(config);
  const { success, remaining, reset } = await limiter.limit(identifier);

  return {
    allowed: success,
    remaining,
    resetAt: reset,
    limit: config.limit,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check rate limit for a given identifier.
 *
 * Uses Upstash Redis when configured, otherwise falls back to in-memory.
 * Returns a Promise so callers must `await` the result.
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  if (isRedisConfigured()) {
    try {
      return await checkRateLimitRedis(identifier, config);
    } catch (error) {
      // If Redis fails, fall back to in-memory so the app stays available
      console.warn(
        'Upstash Redis rate limit failed, falling back to in-memory:',
        error instanceof Error ? error.message : 'Unknown error'
      );
      return checkRateLimitInMemory(identifier, config);
    }
  }

  return checkRateLimitInMemory(identifier, config);
}

/**
 * Get client identifier from request.
 * Uses X-Forwarded-For header or falls back to a default.
 */
export function getClientIdentifier(request: Request): string {
  // Try to get IP from headers (common in proxied environments)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // Take the first IP (client IP)
    const ip = forwarded.split(',')[0]?.trim();
    if (ip) return ip;
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;

  // Fallback for development
  return 'anonymous';
}

/**
 * Rate limit configurations for different endpoints
 */
export const RATE_LIMITS = {
  /** Upload endpoint - allow 10 uploads per minute */
  upload: { limit: 10, windowMs: 60 * 1000 },
  /** Process endpoint - allow 20 process requests per minute */
  process: { limit: 20, windowMs: 60 * 1000 },
  /** Validate endpoint - allow 60 validations per minute */
  validate: { limit: 60, windowMs: 60 * 1000 },
  /** Generate endpoint - allow 30 generations per minute */
  generate: { limit: 30, windowMs: 60 * 1000 },
} as const;

/**
 * Create rate limit headers for response
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(result.resetAt / 1000).toString(),
  };
}
