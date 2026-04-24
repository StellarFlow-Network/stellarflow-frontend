// ── Types ────────────────────────────────────────────────────────────────────

export interface AuditEvent {
  timestamp: string;       // ISO 8601
  adminIdentity: string;
  outcome: 'success' | 'failure';
  failureReason?: string;
}

// ── logReloadEvent ────────────────────────────────────────────────────────────

/**
 * Emits a structured JSON audit log entry for a secret-key reload event.
 *
 * The entry includes a fixed `event` discriminator plus all fields from the
 * supplied AuditEvent. An optional `currentKey` may be passed so that any
 * accidental occurrence of the key value is redacted before writing.
 *
 * Requirements: 8.1, 8.2, 8.3
 */
export function logReloadEvent(event: AuditEvent, currentKey?: string): void {
  const entry = {
    event: 'secret-key-reload',
    timestamp: event.timestamp,
    adminIdentity: event.adminIdentity,
    outcome: event.outcome,
    ...(event.failureReason !== undefined && { failureReason: event.failureReason }),
  };

  let serialized = JSON.stringify(entry);

  // Best-effort redaction: replace any occurrence of the current key (Req 8.2)
  if (currentKey && currentKey.length > 0) {
    serialized = serialized.split(currentKey).join('[REDACTED]');
  }

  console.log(serialized);
}
