import { StellarExpertBlacklistAPI } from "./stellarExpertBlacklistAPI";

export interface AddressSecurityResult {
  isBlacklisted: boolean;
  reason?: string;
  source?: string;
  checked: boolean;
}

export interface AddressSecurityConfig {
  timeoutMs: number;
  cacheTtlMs: number;
  auditLogKey: string;
}

const DEFAULT_CONFIG: AddressSecurityConfig = {
  timeoutMs: 40,
  cacheTtlMs: 60_000,
  auditLogKey: "stellar_security_audit_log",
};

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  address: string;
  reason: string;
  source: string;
  action: "blocked" | "overridden";
  userAgent?: string;
}

export class AddressSecurityChecker {
  private readonly config: AddressSecurityConfig;
  private readonly blacklistApi: StellarExpertBlacklistAPI;
  private readonly cache: Map<string, { result: AddressSecurityResult; expiresAt: number }>;

  constructor(
    config: Partial<AddressSecurityConfig> = {},
    blacklistApi?: StellarExpertBlacklistAPI,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.blacklistApi = blacklistApi ?? new StellarExpertBlacklistAPI();
    this.cache = new Map();
  }

  /**
   * Silently checks a destination address against known phishing/scam blacklists.
   * Returns within configured timeout (<50ms by default) and never throws.
   */
  async checkAddress(address: string): Promise<AddressSecurityResult> {
    const normalized = (address ?? "").trim();
    if (!normalized) {
      return { isBlacklisted: false, checked: false };
    }

    const cached = this.cache.get(normalized);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }

    const result = await this.queryWithTimeout(normalized);
    this.cache.set(normalized, {
      result,
      expiresAt: Date.now() + this.config.cacheTtlMs,
    });
    return result;
  }

  /**
   * Blocks transfer execution if the address is flagged. Throws an error with
   * the security result attached so the UI can render the red alert modal.
   */
  async enforceAddressSecurity(address: string): Promise<AddressSecurityResult> {
    const result = await this.checkAddress(address);
    if (result.isBlacklisted) {
      this.logBlockedAttempt(address, result, "blocked");
      const error = new Error(
        `Transfer blocked: destination address is flagged as a known phishing/scam threat,${
          result.reason ? `${result.reason} (source: ${result.source})` : ""
        }`,
      );
      (error as any).securityResult = result;
      (error as any).code = "ADDRESS_BLACKLISTED";
      throw error;
    }
    return result;
  }

  /**
   * Records a user override of a blocked address in the local audit log.
   */
  logOverride(address: string, result: AddressSecurityResult): void {
    this.logBlockedAttempt(address, result, "overridden");
  }

  getAuditLog(): AuditLogEntry[] {
    try {
      const raw = this.getStorage()?.getItem(this.config.auditLogKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  clearAuditLog(): void {
    this.getStorage()?.removeItem(this.config.auditLogKey);
  }

  private logBlockedAttempt(
    address: string,
    result: AddressSecurityResult,
    action: AuditLogEntry["action"],
  ): void {
    const storage = this.getStorage();
    if (!storage) {
      return;
    }
    const entry: AuditLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      timestamp: Date.now(),
      address: address.trim(),
      reason: result.reason ?? "unknown",
      source: result.source ?? "stellarexpert",
      action,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    };
    try {
      const log = this.getAuditLog();
      log.push(entry);
      // Bound the log to the most recent 200 entries.
      const trimmed = log.slice(-200);
      storage.setItem(this.config.auditLogKey, JSON.stringify(trimmed));
    } catch {
      // Audit logging must never break the transfer flow.
    }
  }

  private async queryWithTimeout(address: string): Promise<AddressSecurityResult> {
    const timeout = new Promise<AddressSecurityResult>((resolve) => {
      setTimeout(
        () => resolve({ isBlacklisted: false, checked: false }),
        this.config.timeoutMs,
      );
    });

    const query = this.blacklistApi
      .isBlacklisted(address)
      .then((entry) => {
        if (!entry) {
          return { isBlacklisted: false, checked: true } as AddressSecurityResult;
        }
        return {
          isBlacklisted: true,
          reason: entry.reason,
          source: entry.source,
          checked: true,
        } as AddressSecurityResult;
      })
      .catch(() => ({ checked: false, isBlacklisted: false }) as AddressSecurityResult);

    return Promise.race([timeout, query]);
  }

  private getStorage(): Storage | null {
    try {
      if (typeof window === "undefined" || !window.localStorage) return null;
      return window.localStorage;
    } catch {
      return null;
    }
  }
}

export const addressSecurityChecker = new AddressSecurityChecker();

export default addressSecurityChecker;
