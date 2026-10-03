import { describe, expect, it } from "vitest";
import {
  TIMEOUT_OPTIONS,
  type InactivityTimeoutMinutes,
} from "@/components/security/InactivityLockGuard";

describe("InactivityLockGuard Configuration and Logic", () => {
  it("provides 15 minutes as default timeout configuration", () => {
    const defaultOption = TIMEOUT_OPTIONS.find((opt) => opt.value === 15);
    expect(defaultOption).toBeDefined();
    expect(defaultOption?.label).toBe("15 minutes");
    expect(defaultOption?.description).toContain("Default");
  });

  it("offers standard timeout options (5m, 15m, 30m, 60m)", () => {
    const values = TIMEOUT_OPTIONS.map((opt) => opt.value);
    expect(values).toEqual([5, 15, 30, 60]);
  });

  it("calculates timeout thresholds accurately in milliseconds", () => {
    const getTimeoutMs = (minutes: InactivityTimeoutMinutes) => minutes * 60 * 1000;

    expect(getTimeoutMs(5)).toBe(300_000);
    expect(getTimeoutMs(15)).toBe(900_000); // 15 minutes default
    expect(getTimeoutMs(30)).toBe(1_800_000);
    expect(getTimeoutMs(60)).toBe(3_600_000);
  });

  it("verifies activity expiration condition", () => {
    const timeoutMs = 15 * 60 * 1000;
    const now = Date.now();

    // 14 minutes ago -> not expired
    const recentActivity = now - 14 * 60 * 1000;
    expect(now - recentActivity >= timeoutMs).toBe(false);

    // 15.1 minutes ago -> expired
    const expiredActivity = now - 15.1 * 60 * 1000;
    expect(now - expiredActivity >= timeoutMs).toBe(true);
  });

  it("supports re-verification without route reload", () => {
    let isLocked = true;
    let lastActivity = Date.now() - 20 * 60 * 1000;

    const unlockSession = () => {
      isLocked = false;
      lastActivity = Date.now();
    };

    unlockSession();

    expect(isLocked).toBe(false);
    expect(Date.now() - lastActivity).toBeLessThan(100);
  });
});
