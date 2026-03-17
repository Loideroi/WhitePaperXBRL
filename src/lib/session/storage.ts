/**
 * Session Persistence
 *
 * Auto-saves and restores whitepaper editing sessions using localStorage.
 * Sessions are indexed for the "Recent Sessions" list on the home page.
 */

const SESSION_PREFIX = 'whitepaper-';
const SESSION_INDEX_KEY = 'whitepaper-sessions';
const MAX_SESSIONS = 10;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface SessionIndex {
  sessionId: string;
  filename: string;
  tokenType: string;
  lastModified: number;
  confidence: number;
}

/**
 * Save session data to localStorage and update the session index.
 */
export function saveSession(
  sessionId: string,
  data: unknown,
  meta: { filename: string; tokenType: string; confidence: number }
): void {
  if (typeof window === 'undefined') return;

  try {
    const existing = localStorage.getItem(`${SESSION_PREFIX}${sessionId}`);
    const parsed = existing ? JSON.parse(existing) : {};

    // Merge edited data into the existing session object
    const session = {
      ...parsed,
      mapping: {
        ...parsed.mapping,
        data,
        confidence: parsed.mapping?.confidence ?? { overall: meta.confidence },
      },
      filename: meta.filename || parsed.filename,
      tokenType: meta.tokenType || parsed.tokenType,
      lastModified: Date.now(),
    };

    localStorage.setItem(`${SESSION_PREFIX}${sessionId}`, JSON.stringify(session));
    updateIndex(sessionId, meta);
  } catch {
    // localStorage quota exceeded or unavailable — silently fail
  }
}

/**
 * Load session data from localStorage.
 */
export function loadSession(sessionId: string): unknown | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(`${SESSION_PREFIX}${sessionId}`);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

/**
 * List all saved sessions, sorted by most recent first.
 */
export function listSessions(): SessionIndex[] {
  if (typeof window === 'undefined') return [];

  try {
    const indexStr = localStorage.getItem(SESSION_INDEX_KEY);
    if (!indexStr) return [];

    const sessions: SessionIndex[] = JSON.parse(indexStr);
    return sessions
      .filter((s) => Date.now() - s.lastModified < SESSION_TTL_MS)
      .sort((a, b) => b.lastModified - a.lastModified);
  } catch {
    return [];
  }
}

/**
 * Delete a session and its index entry.
 */
export function deleteSession(sessionId: string): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(`${SESSION_PREFIX}${sessionId}`);
    const sessions = listSessions().filter((s) => s.sessionId !== sessionId);
    localStorage.setItem(SESSION_INDEX_KEY, JSON.stringify(sessions));
  } catch {
    // Silently fail
  }
}

/**
 * Clean expired sessions from localStorage.
 */
export function cleanExpiredSessions(): void {
  if (typeof window === 'undefined') return;

  try {
    const indexStr = localStorage.getItem(SESSION_INDEX_KEY);
    if (!indexStr) return;

    const sessions: SessionIndex[] = JSON.parse(indexStr);
    const now = Date.now();
    const active: SessionIndex[] = [];

    for (const session of sessions) {
      if (now - session.lastModified >= SESSION_TTL_MS) {
        localStorage.removeItem(`${SESSION_PREFIX}${session.sessionId}`);
      } else {
        active.push(session);
      }
    }

    localStorage.setItem(SESSION_INDEX_KEY, JSON.stringify(active));
  } catch {
    // Silently fail
  }
}

/**
 * Update the session index with a new or modified session.
 */
function updateIndex(
  sessionId: string,
  meta: { filename: string; tokenType: string; confidence: number }
): void {
  try {
    const sessions = listSessions().filter((s) => s.sessionId !== sessionId);

    sessions.unshift({
      sessionId,
      filename: meta.filename,
      tokenType: meta.tokenType,
      lastModified: Date.now(),
      confidence: meta.confidence,
    });

    // Cap at MAX_SESSIONS
    const trimmed = sessions.slice(0, MAX_SESSIONS);
    localStorage.setItem(SESSION_INDEX_KEY, JSON.stringify(trimmed));
  } catch {
    // Silently fail
  }
}
