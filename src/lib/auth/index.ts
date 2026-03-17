/**
 * Auth.js exports
 *
 * Central auth module — import { auth, signIn, signOut } from '@/lib/auth'
 */

import NextAuth from 'next-auth';
import { authConfig } from './config';

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
