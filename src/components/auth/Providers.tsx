'use client';

/**
 * Client-side Providers wrapper
 *
 * Wraps children with SessionProvider for next-auth.
 */

import { SessionProvider } from 'next-auth/react';

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
