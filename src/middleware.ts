/**
 * Auth Middleware
 *
 * Protects routes that require authentication.
 * Auth is disabled when AUTH_SECRET is not configured (allows deployment
 * without OAuth providers set up).
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // Skip auth enforcement entirely when AUTH_SECRET is not configured.
  // This allows the app to run without OAuth providers on Vercel.
  if (!process.env.AUTH_SECRET) {
    return NextResponse.next();
  }

  // Dynamically import auth only when credentials are present
  const { auth } = await import('@/lib/auth');
  const session = await auth();

  if (!session?.user) {
    // Redirect API calls to 401, page requests to sign-in
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/auth/signin', request.url));
  }

  return NextResponse.next();
}

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
