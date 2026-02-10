import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  checkRateLimit,
  getClientIdentifier,
  rateLimitHeaders,
  RATE_LIMITS,
  type RateLimitConfig,
} from '@/lib/security/rate-limiter';

describe('Rate Limiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const testConfig: RateLimitConfig = { limit: 3, windowMs: 60_000 };

  describe('checkRateLimit', () => {
    it('should allow the first request', () => {
      const result = checkRateLimit('test-first', testConfig);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
      expect(result.limit).toBe(3);
    });

    it('should decrement remaining on each request', () => {
      const r1 = checkRateLimit('test-decrement', testConfig);
      const r2 = checkRateLimit('test-decrement', testConfig);

      expect(r1.remaining).toBe(2);
      expect(r2.remaining).toBe(1);
    });

    it('should deny requests over the limit', () => {
      checkRateLimit('test-over', testConfig);
      checkRateLimit('test-over', testConfig);
      checkRateLimit('test-over', testConfig);
      const r4 = checkRateLimit('test-over', testConfig);

      expect(r4.allowed).toBe(false);
      expect(r4.remaining).toBe(0);
    });

    it('should reset the window after expiry', () => {
      checkRateLimit('test-reset', testConfig);
      checkRateLimit('test-reset', testConfig);
      checkRateLimit('test-reset', testConfig);

      // Advance past the window
      vi.advanceTimersByTime(61_000);

      const result = checkRateLimit('test-reset', testConfig);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });

    it('should track identifiers independently', () => {
      checkRateLimit('user-a', testConfig);
      checkRateLimit('user-a', testConfig);
      checkRateLimit('user-a', testConfig);

      // user-a is now at limit, but user-b should be fresh
      const resultA = checkRateLimit('user-a', testConfig);
      const resultB = checkRateLimit('user-b', testConfig);

      expect(resultA.allowed).toBe(false);
      expect(resultB.allowed).toBe(true);
      expect(resultB.remaining).toBe(2);
    });

    it('should include resetAt timestamp in the future', () => {
      vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));

      const result = checkRateLimit('test-resetat', testConfig);

      expect(result.resetAt).toBeGreaterThan(Date.now());
    });
  });

  describe('getClientIdentifier', () => {
    it('should use x-forwarded-for first IP', () => {
      const request = new Request('http://localhost', {
        headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
      });

      expect(getClientIdentifier(request)).toBe('1.2.3.4');
    });

    it('should use x-real-ip as fallback', () => {
      const request = new Request('http://localhost', {
        headers: { 'x-real-ip': '10.0.0.1' },
      });

      expect(getClientIdentifier(request)).toBe('10.0.0.1');
    });

    it('should return anonymous when no IP headers', () => {
      const request = new Request('http://localhost');

      expect(getClientIdentifier(request)).toBe('anonymous');
    });

    it('should prefer x-forwarded-for over x-real-ip', () => {
      const request = new Request('http://localhost', {
        headers: {
          'x-forwarded-for': '1.2.3.4',
          'x-real-ip': '10.0.0.1',
        },
      });

      expect(getClientIdentifier(request)).toBe('1.2.3.4');
    });
  });

  describe('RATE_LIMITS', () => {
    it('should have correct upload config', () => {
      expect(RATE_LIMITS.upload.limit).toBe(10);
      expect(RATE_LIMITS.upload.windowMs).toBe(60_000);
    });

    it('should have correct validate config', () => {
      expect(RATE_LIMITS.validate.limit).toBe(60);
    });

    it('should have correct generate config', () => {
      expect(RATE_LIMITS.generate.limit).toBe(30);
    });
  });

  describe('rateLimitHeaders', () => {
    it('should return correct header names and values', () => {
      const headers = rateLimitHeaders({
        allowed: true,
        remaining: 5,
        resetAt: 1750000000000,
        limit: 10,
      });

      expect(headers['X-RateLimit-Limit']).toBe('10');
      expect(headers['X-RateLimit-Remaining']).toBe('5');
      expect(headers['X-RateLimit-Reset']).toBe(Math.ceil(1750000000000 / 1000).toString());
    });
  });
});
