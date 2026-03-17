/**
 * Auth Middleware
 *
 * Protects routes that require authentication.
 * Auth is disabled in development when AUTH_GITHUB_ID is not set.
 */

export { auth as middleware } from '@/lib/auth';

export const config = {
  matcher: [
    '/transform/:path*',
    '/api/generate',
    '/api/validate',
    '/api/upload',
    '/api/lei-lookup',
    '/api/batch',
  ],
};
