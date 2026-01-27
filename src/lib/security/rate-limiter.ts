/**
 * Simple in-memory rate limiter for API routes
 *
 * In production, consider using Redis or a dedicated rate limiting service.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (use Redis in production)
const store = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}, 60 * 1000); // Every minute

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

/**
 * Check rate limit for a given identifier
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(identifier);

  // If no entry or window expired, create new entry
  if (!entry || entry.resetAt <= now) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + config.windowMs,
    };
    store.set(identifier, newEntry);

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

/**
 * Get client identifier from request
 * Uses X-Forwarded-For header or falls back to a default
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
