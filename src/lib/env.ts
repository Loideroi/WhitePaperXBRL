/**
 * Environment variable validation and configuration
 *
 * Validates required environment variables at runtime.
 */

import { z } from 'zod';

/**
 * Environment schema
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // Optional GLEIF API URL (public API, no auth needed)
  GLEIF_API_URL: z.string().url().optional(),
  // Optional GLEIF API key for authenticated access (Bearer token)
  LEI_API_KEY: z.string().min(1).optional(),
  // Optional Redis URL for production rate limiting
  REDIS_URL: z.string().url().optional(),
});

/**
 * Type for validated environment
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Cached validated environment
 */
let cachedEnv: Env | undefined;

/**
 * Get validated environment variables
 */
export function getEnv(): Env {
  if (cachedEnv) {
    return cachedEnv;
  }

  const result = envSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    GLEIF_API_URL: process.env.GLEIF_API_URL,
    LEI_API_KEY: process.env.LEI_API_KEY,
    REDIS_URL: process.env.REDIS_URL,
  });

  if (!result.success) {
    console.error('Invalid environment variables:', result.error.flatten().fieldErrors);

    // In production, this is a fatal error
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Invalid environment variables: ${JSON.stringify(result.error.flatten().fieldErrors)}`);
    }

    // In development, use defaults
    cachedEnv = {
      NODE_ENV: 'development',
      GLEIF_API_URL: undefined,
      LEI_API_KEY: undefined,
      REDIS_URL: undefined,
    };

    return cachedEnv;
  }

  cachedEnv = result.data;
  return cachedEnv;
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return getEnv().NODE_ENV === 'production';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return getEnv().NODE_ENV === 'development';
}

/**
 * Check if running in test
 */
export function isTest(): boolean {
  return getEnv().NODE_ENV === 'test';
}

/**
 * Get GLEIF API URL with fallback
 */
export function getGLEIFApiUrl(): string {
  return getEnv().GLEIF_API_URL || 'https://api.gleif.org/api/v1';
}
