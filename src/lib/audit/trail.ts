/**
 * Audit Trail
 *
 * Records user actions for compliance and debugging.
 * Stores events in localStorage (client-side) per session.
 * In production, events can be forwarded to an external logging service.
 */

export type AuditAction =
  | 'upload'
  | 'extract'
  | 'field_edit'
  | 'validate'
  | 'generate'
  | 'download'
  | 'session_restore'
  | 'session_delete';

export interface AuditEvent {
  timestamp: number;
  action: AuditAction;
  sessionId: string;
  details?: Record<string, unknown>;
}

const AUDIT_PREFIX = 'audit-';
const MAX_EVENTS_PER_SESSION = 500;

/**
 * Record an audit event for a session.
 */
export function recordEvent(
  sessionId: string,
  action: AuditAction,
  details?: Record<string, unknown>
): void {
  if (typeof window === 'undefined') return;

  const event: AuditEvent = {
    timestamp: Date.now(),
    action,
    sessionId,
    details,
  };

  try {
    const key = `${AUDIT_PREFIX}${sessionId}`;
    const existing = localStorage.getItem(key);
    const events: AuditEvent[] = existing ? JSON.parse(existing) : [];

    events.push(event);

    // Cap events to prevent unbounded growth
    const trimmed = events.length > MAX_EVENTS_PER_SESSION
      ? events.slice(-MAX_EVENTS_PER_SESSION)
      : events;

    localStorage.setItem(key, JSON.stringify(trimmed));
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

/**
 * Get all audit events for a session.
 */
export function getEvents(sessionId: string): AuditEvent[] {
  if (typeof window === 'undefined') return [];

  try {
    const key = `${AUDIT_PREFIX}${sessionId}`;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Export audit trail as a downloadable JSON file.
 */
export function exportAuditTrail(sessionId: string): string {
  const events = getEvents(sessionId);
  return JSON.stringify(
    {
      sessionId,
      exportedAt: new Date().toISOString(),
      eventCount: events.length,
      events: events.map((e) => ({
        ...e,
        timestampISO: new Date(e.timestamp).toISOString(),
      })),
    },
    null,
    2
  );
}

/**
 * Clear audit trail for a session.
 */
export function clearAuditTrail(sessionId: string): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(`${AUDIT_PREFIX}${sessionId}`);
  } catch {
    // Silently fail
  }
}

/**
 * Record an audit event on the server side (for API routes).
 * Logs to stdout in structured JSON format for log aggregation services.
 */
export function recordServerEvent(
  action: AuditAction,
  details: Record<string, unknown>
): void {
  const event = {
    type: 'audit',
    timestamp: new Date().toISOString(),
    action,
    ...details,
  };

  // Structured JSON log — consumed by Vercel Log Drains, Datadog, etc.
  console.log(JSON.stringify(event));
}
