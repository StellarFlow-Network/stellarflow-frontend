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
