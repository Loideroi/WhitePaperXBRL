'use client';

/**
 * Sign In / Sign Out Button
 *
 * Shows sign-in when unauthenticated, user avatar + sign-out when authenticated.
 */

import { useSession, signIn, signOut } from 'next-auth/react';
import { LogIn, LogOut } from 'lucide-react';

export function SignInButton() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <div className="h-8 w-20 rounded bg-muted animate-pulse" />
    );
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground truncate max-w-[150px]">
          {session.user.name || session.user.email}
        </span>
        <button
          onClick={() => signOut()}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs border hover:bg-muted"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => signIn()}
      className="flex items-center gap-1 rounded px-3 py-1.5 text-sm bg-primary text-primary-foreground hover:bg-primary/90"
    >
      <LogIn className="h-4 w-4" />
      Sign in
    </button>
  );
}
