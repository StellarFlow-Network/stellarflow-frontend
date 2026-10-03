/**
 * Security Components Export
 *
 * Centralized exports for security-related components including
 * session timeout management, screen lock, and allowance management.
 */

export { SessionTimeoutManager, useSessionTimeout } from "./SessionTimeoutManager";
export type { AutoLockDuration } from "./SessionTimeoutManager";

export { AutoLockSettings } from "./AutoLockSettings";

export {
  ScreenLockModal,
  ScreenLockProvider,
  useScreenLock,
  IDLE_TIMEOUT_OPTIONS,
} from "./ScreenLockModal";
export type { PinLength, IdleTimeoutMinutes } from "./ScreenLockModal";

export { AllowanceManager } from "./AllowanceManager";

export { CspViolationDashboard } from "./CspViolationDashboard";
export { CspReporterInit } from "./CspReporterInit";

export { InactivityLockGuard, useInactivityLock, TIMEOUT_OPTIONS } from "./InactivityLockGuard";
export type {
  InactivityTimeoutMinutes,
  InactivityLockGuardProps,
  InactivityLockContextType,
} from "./InactivityLockGuard";

// ── Passkey / WebAuthn ──────────────────────────────────────────────────────
// Context provider — wrap your security-guarded subtree with this:
//   import { PasskeyProvider } from "@/components/security";
//   <PasskeyProvider>{children}</PasskeyProvider>
export { PasskeyProvider, usePasskeys, usePasskeyStore, classifyPasskeyError, detectPasskeySupport } from "@/hooks/usePasskeys";
export type { PasskeyDevice, PasskeyError, PasskeyContextType } from "@/hooks/usePasskeys";

export { BiometricAnimation } from "./BiometricAnimation";
export type { BiometricState } from "./BiometricAnimation";

export { PasskeyRegisterModal } from "./PasskeyRegisterModal";
export type { PasskeyRegisterModalProps } from "./PasskeyRegisterModal";

export { PasskeyLoginPrompt } from "./PasskeyLoginPrompt";
export type { PasskeyLoginPromptProps } from "./PasskeyLoginPrompt";

export { PasskeyDeviceList } from "./PasskeyDeviceList";
export type { PasskeyDeviceListProps } from "./PasskeyDeviceList";
