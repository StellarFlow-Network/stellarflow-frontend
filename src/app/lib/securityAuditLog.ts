import { secureStorage } from "./secureStorage";

export interface SecurityAuditEntry {
  id: string;
  timestamp: number;
  event: "blocked_phishing_attempt" | "allowed_override" | "cleared_address";
  address: string;
  chain: string;
  reason?: string;
  source?: string;
  amount?: string;
  override?: boolean;
  userAgent?: string;
}

const AUDIT_LOG_KEY = "security-audit-log-v1";
const MAX_ENTRIES = 500;

function generateId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return `sec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getUserAgent(): string | undefined {
  if (typeof navigator === "undefined") return undefined;
  return navigator.userAgent;
}

function readRaw(): SecurityAuditEntry[] {
  try {
    const raw = secureStorage.getItem(AUDIT_LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e: unknown): e is SecurityAuditEntry =>
        !!e && typeof e === "object" && typeof (e as SecurityAuditEntry).id === "string",
    );
  } catch {
    return [];
  }
}

function writeRaw(entries: SecurityAuditEntry[]): void {
  try {
    const trimmed = entries.slice(-MAX_ENTRIES);
    secureStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(trimmed));
  } catch {
    /* storage full or unavailable - audit log must not break transfer flow */
  }
}

export function logSecurityEvent(
  event: SecurityAuditEntry["event"],
  data: Omit<SecurityAuditEntry, "id" | "timestamp" | "event" | "userAgent">,
): SecurityAuditEntry {
  const entry: SecurityAuditEntry = {
    id: generateId(),
    timestamp: Date.now(),
    event,
    address: data.address,
    chain: data.chain,
    reason: data.reason,
    source: data.source,
    amount: data.amount,
    override: data.override,
    userAgent: getUserAgent(),
  };
  const existing = readRaw();
  existing.push(entry);
  writeRaw(existing);
  return entry;
}

export function logBlockedPhishingAttempt(data: {
  address: string;
  chain: string;
  reason?: string;
  source?: string;
  amount?: string;
}): SecurityAuditEntry {
  return logSecurityEvent("blocked_phishing_attempt", { ...data, override: false });
}

export function logOverride(data: {
  address: string;
  chain: string;
  reason?: string;
  source?: string;
  amount?: string;
}): SecurityAuditEntry {
  return logSecurityEvent("allowed_override", { ...data, override: true });
}

export function getSecurityAuditLog(): SecurityAuditEntry[] {
  return readRaw().sort((a, b) => b.timestamp - a.timestamp);
}

export function getBlockedPhishingAttempts(): SecurityAuditEntry[] {
  return getSecurityAuditLog().filter((e => e.event === "blocked_phishing_attempt");
}

export function clearSecurityAuditLog(): void {
  try {
    secureStorage.removeItem(AUDIT_LOG_KEY);
  } catch {
    /* ignore */
  }
}
