/**
 * haptics.ts
 *
 * Core Native Mobile Haptic Feedback Engine for StellarFlow.
 * Utilizes the standard Web `navigator.vibrate` API to deliver tactile vibration cues
 * for mobile Web3 actions (button taps, slider adjustments, transaction confirmations).
 *
 * Designed with:
 * - Robust SSR safety and feature detection
 * - User preference persistence in localStorage (`sf_haptics_enabled`)
 * - Accessibility support: respects `prefers-reduced-motion: reduce`
 * - Micro-throttling to avoid motor overdrive or vibration queue fatigue
 * - Zero external dependencies
 */

export const HAPTIC_STORAGE_KEY = 'sf_haptics_enabled';
export const HAPTIC_CHANGE_EVENT = 'sf_haptics_change';

/**
 * Predefined vibration timing patterns in milliseconds.
 * - Numbers denote a single vibration pulse duration.
 * - Arrays represent [vibrate_ms, pause_ms, vibrate_ms, ...].
 */
export const HAPTIC_PATTERNS = {
  /** Short crisp pulse for standard button presses, icon taps, and tab changes (12ms) */
  tap: 12,
  /** Light micro-pulse for fine slider scrub adjustments and stepper clicks (8ms) */
  slider: 8,
  /** Medium tactile click for modal openings, toggles, and dropdown item selection (20ms) */
  selection: 20,
  /** Distinct double-pulse pattern for transaction submission and successful confirmation [40ms, 60ms pause, 40ms] */
  txConfirm: [40, 60, 40],
  /** Warning vibration pattern [30ms, 50ms pause, 30ms, 50ms pause, 30ms] */
  warning: [30, 50, 30, 50, 30],
  /** Error vibration pattern for rejected or failed transactions [80ms, 50ms pause, 80ms] */
  error: [80, 50, 80],
} as const;

export type HapticPreset = keyof typeof HAPTIC_PATTERNS;
export type HapticPattern = HapticPreset | number | number[] | readonly number[];

/** State tracking for cooldowns */
let lastTriggerTime = 0;
let lastSliderTriggerTime = 0;
const TAP_COOLDOWN_MS = 40;
const SLIDER_COOLDOWN_MS = 35;

/**
 * Check if the current browser and platform support the Web Vibration API.
 */
export function isHapticsSupported(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const nav = typeof navigator !== 'undefined' ? navigator : (window as { navigator?: Navigator }).navigator;
  return typeof nav?.vibrate === 'function';
}

/**
 * Check if the user has requested reduced motion in their system accessibility settings.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return false;
  }
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Read the persisted haptics enabled flag from localStorage.
 * Defaults to true for mobile devices when supported.
 */
export function getHapticsEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const stored = window.localStorage.getItem(HAPTIC_STORAGE_KEY);
    if (stored === null) return true; // Enabled by default
    return stored === 'true';
  } catch {
    return true;
  }
}

/**
 * Persist the haptics preference and broadcast change event to active listeners.
 */
export function setHapticsEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(HAPTIC_STORAGE_KEY, String(enabled));
    window.dispatchEvent(new CustomEvent(HAPTIC_CHANGE_EVENT, { detail: { enabled } }));
  } catch {
    // Silently ignore storage quota or private browsing errors
  }
}

/**
 * Toggle the current haptics preference.
 * Returns the new state.
 */
export function toggleHaptics(): boolean {
  const next = !getHapticsEnabled();
  setHapticsEnabled(next);
  return next;
}

/**
 * Resolve any preset name, number, or array into a standard VibratePattern format.
 */
export function resolvePattern(pattern: HapticPattern): number | number[] {
  if (typeof pattern === 'string' && pattern in HAPTIC_PATTERNS) {
    const val = HAPTIC_PATTERNS[pattern as HapticPreset];
    return Array.isArray(val) ? [...val] : (val as number);
  }
  return Array.isArray(pattern) ? [...pattern] : (pattern as number);
}

/**
 * Triggers a tactile vibration on the user's device if supported and enabled.
 *
 * @param pattern Preset name ('tap', 'slider', 'selection', 'txConfirm', 'warning', 'error') or custom pattern
 * @param force If true, bypasses throttle cooldowns (e.g. for preview testing)
 * @returns boolean indicating whether vibration was successfully dispatched
 */
export function triggerHaptic(
  pattern: HapticPattern = 'tap',
  force: boolean = false
): boolean {
  // 1. SSR and Feature Detection Check
  if (!isHapticsSupported()) {
    return false;
  }

  // 2. User Preference Check
  if (!getHapticsEnabled()) {
    return false;
  }

  // 3. Accessibility Check
  if (prefersReducedMotion()) {
    return false;
  }

  // 4. Rate-limiting & Cooldown Logic
  const now = Date.now();
  const isSlider = pattern === 'slider';

  if (!force) {
    if (isSlider) {
      if (now - lastSliderTriggerTime < SLIDER_COOLDOWN_MS) {
        return false;
      }
      lastSliderTriggerTime = now;
    } else {
      if (now - lastTriggerTime < TAP_COOLDOWN_MS) {
        return false;
      }
      lastTriggerTime = now;
    }
  }

  // 5. Execute Vibration
  try {
    const resolved = resolvePattern(pattern);
    const nav = typeof navigator !== 'undefined' ? navigator : (window as { navigator?: Navigator }).navigator;
    return nav ? nav.vibrate(resolved) : false;
  } catch {
    return false;
  }
}

/** Stop any ongoing vibration pattern immediately */
export function cancelHaptic(): boolean {
  if (!isHapticsSupported()) return false;
  try {
    const nav = typeof navigator !== 'undefined' ? navigator : (window as { navigator?: Navigator }).navigator;
    return nav ? nav.vibrate(0) : false;
  } catch {
    return false;
  }
}
