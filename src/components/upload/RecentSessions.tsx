'use client';

/**
 * Recent Sessions Component
 *
 * Shows a list of previously saved sessions that the user can resume or delete.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Trash2, FileText } from 'lucide-react';
import {
  listSessions,
  deleteSession,
  cleanExpiredSessions,
  type SessionIndex,
} from '@/lib/session/storage';

/**
 * Format a timestamp as a human-readable age string.
 * Defined at module level to keep the component render pure.
 */
function formatAge(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function loadSessions(): { sessions: SessionIndex[]; ages: Record<string, string> } {
  if (typeof window === 'undefined') return { sessions: [], ages: {} };
  cleanExpiredSessions();
  const loaded = listSessions();
  const ages: Record<string, string> = {};
  for (const s of loaded) {
    ages[s.sessionId] = formatAge(s.lastModified);
  }
  return { sessions: loaded, ages };
}

export function RecentSessions() {
  const router = useRouter();
  const [data, setData] = useState(loadSessions);

  if (data.sessions.length === 0) return null;

  function handleResume(sessionId: string) {
    router.push(`/transform/${sessionId}`);
  }

  function handleDelete(sessionId: string) {
    deleteSession(sessionId);
    setData(loadSessions());
  }

  return (
    <div className="mt-8 w-full max-w-2xl mx-auto">
      <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
        <Clock className="h-4 w-4" />
        Recent Sessions
      </h3>
      <div className="space-y-2">
        {data.sessions.map((session) => (
          <div
            key={session.sessionId}
            className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 hover:bg-muted/50 transition-colors"
          >
            <button
              onClick={() => handleResume(session.sessionId)}
              className="flex items-center gap-3 flex-1 text-left"
            >
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{session.filename}</p>
                <p className="text-xs text-muted-foreground">
                  {session.tokenType} &middot; {Math.round(session.confidence * 100)}% confidence &middot; {data.ages[session.sessionId] ?? ''}
                </p>
              </div>
            </button>
            <button
              onClick={() => handleDelete(session.sessionId)}
              className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0"
              aria-label="Delete session"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
