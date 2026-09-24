/**
 * haptics.test.ts
 *
 * Automated Unit Tests for Native Mobile Haptic Feedback Engine (#771).
 * Tests pattern resolution, navigator.vibrate execution, storage persistence,
 * rate limiting cooldowns, and reduced-motion accessibility overrides.
 */

import {
  isHapticsSupported,
  getHapticsEnabled,
  setHapticsEnabled,
  toggleHaptics,
  triggerHaptic,
  cancelHaptic,
  resolvePattern,
  HAPTIC_PATTERNS,
  HAPTIC_STORAGE_KEY,
} from './haptics';

describe('Native Mobile Haptics Engine', () => {
  let mockVibrate: jest.Mock;
  let mockStorage: Record<string, string>;

  beforeEach(() => {
    mockStorage = {};
    mockVibrate = jest.fn().mockReturnValue(true);

    // Mock window.localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (k: string) => mockStorage[k] ?? null,
        setItem: (k: string, v: string) => {
          mockStorage[k] = String(v);
        },
        removeItem: (k: string) => {
          delete mockStorage[k];
        },
        clear: () => {
          mockStorage = {};
        },
      },
      writable: true,
    });

    // Mock navigator.vibrate
    Object.defineProperty(window.navigator, 'vibrate', {
      value: mockVibrate,
      writable: true,
      configurable: true,
    });

    // Mock matchMedia for reduced motion (default: no reduced motion)
    Object.defineProperty(window, 'matchMedia', {
      value: jest.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Feature Detection & Support', () => {
    it('detects vibration API support when navigator.vibrate is defined', () => {
      expect(isHapticsSupported()).toBe(true);
    });

    it('returns false when navigator.vibrate is undefined', () => {
      Object.defineProperty(window.navigator, 'vibrate', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      expect(isHapticsSupported()).toBe(false);
    });
  });

  describe('Preference Persistence', () => {
    it('defaults to enabled when no preference is saved', () => {
      expect(getHapticsEnabled()).toBe(true);
    });

    it('persists disabled state to localStorage', () => {
      setHapticsEnabled(false);
      expect(getHapticsEnabled()).toBe(false);
      expect(mockStorage[HAPTIC_STORAGE_KEY]).toBe('false');
    });

    it('toggles preference state', () => {
      expect(getHapticsEnabled()).toBe(true);
      const newState = toggleHaptics();
      expect(newState).toBe(false);
      expect(getHapticsEnabled()).toBe(false);
      const toggleBack = toggleHaptics();
      expect(toggleBack).toBe(true);
      expect(getHapticsEnabled()).toBe(true);
    });
  });

  describe('Pattern Resolution', () => {
    it('resolves preset pattern names correctly', () => {
      expect(resolvePattern('tap')).toBe(HAPTIC_PATTERNS.tap);
      expect(resolvePattern('slider')).toBe(HAPTIC_PATTERNS.slider);
      expect(resolvePattern('txConfirm')).toEqual(HAPTIC_PATTERNS.txConfirm);
      expect(resolvePattern('error')).toEqual(HAPTIC_PATTERNS.error);
    });

    it('passes through custom numeric and array patterns', () => {
      expect(resolvePattern(25)).toBe(25);
      expect(resolvePattern([50, 100, 50])).toEqual([50, 100, 50]);
    });
  });

  describe('Trigger Execution', () => {
    it('calls navigator.vibrate with resolved pattern on triggerHaptic', () => {
      const result = triggerHaptic('tap', true);
      expect(result).toBe(true);
      expect(mockVibrate).toHaveBeenCalledWith(HAPTIC_PATTERNS.tap);
    });

    it('triggers double pulse pattern for txConfirm', () => {
      const result = triggerHaptic('txConfirm', true);
      expect(result).toBe(true);
      expect(mockVibrate).toHaveBeenCalledWith(HAPTIC_PATTERNS.txConfirm);
    });

    it('does not trigger vibration when user preference is disabled', () => {
      setHapticsEnabled(false);
      const result = triggerHaptic('tap', true);
      expect(result).toBe(false);
      expect(mockVibrate).not.toHaveBeenCalled();
    });

    it('does not trigger vibration when prefers-reduced-motion is active', () => {
      (window.matchMedia as jest.Mock).mockReturnValue({ matches: true });
      const result = triggerHaptic('tap', true);
      expect(result).toBe(false);
      expect(mockVibrate).not.toHaveBeenCalled();
    });

    it('cancels active haptics via cancelHaptic', () => {
      cancelHaptic();
      expect(mockVibrate).toHaveBeenCalledWith(0);
    });
  });
});
