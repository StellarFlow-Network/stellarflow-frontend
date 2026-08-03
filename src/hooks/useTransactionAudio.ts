'use client';

/**
 * useTransactionAudio.ts
 *
 * Provides synthesized audio chimes for transaction events using the Web Audio API.
 * No external dependencies — all sounds are synthesized at runtime.
 *
 * Chime design:
 *   success  — two ascending tones  (C5 → E5, 80ms + 120ms, sine,     gain 0.3)
 *   warning  — single mid tone      (A4,       200ms,        triangle, gain 0.25)
 *   failure  — two descending tones (G4 → D4, 100ms + 150ms, sawtooth, gain 0.2)
 *
 * AudioContext is lazily initialized on first play call (browsers require a
 * user gesture before creating an AudioContext).
 *
 * The enabled state is persisted to localStorage under the key 'sf_audio_enabled'.
 * Defaults to disabled (false) per product spec.
 *
 * SSR-safe: all Web Audio API calls are guarded by `typeof window !== 'undefined'`.
 */

import { useCallback, useRef, useState } from 'react';

const STORAGE_KEY = 'sf_audio_enabled';

/** Read the persisted enabled flag (defaults to false = muted). */
function readStoredEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    // Only return true if explicitly stored as 'true'
    return stored === 'true';
  } catch {
    return false;
  }
}

/** Persist the enabled flag to localStorage. */
function writeStoredEnabled(value: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // Private browsing / storage quota — silently ignore
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Low-level synthesis helpers
// ─────────────────────────────────────────────────────────────────────────────

type OscillatorType = 'sine' | 'triangle' | 'sawtooth' | 'square';

interface ToneParams {
  frequency: number;
  /** Duration in seconds */
  duration: number;
  type: OscillatorType;
  gain: number;
  /** Start time offset in seconds (relative to AudioContext.currentTime) */
  startOffset: number;
}

/**
 * Schedules a single synthesized tone via the Web Audio API.
 * Uses a short linear ramp-down to prevent click artifacts at note end.
 */
function scheduleTone(ctx: AudioContext, params: ToneParams): void {
  const { frequency, duration, type, gain, startOffset } = params;

  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime + startOffset);

  gainNode.gain.setValueAtTime(gain, ctx.currentTime + startOffset);
  // Soft release: ramp to zero over the last 10 ms to avoid clicks
  const releaseStart = ctx.currentTime + startOffset + duration - 0.01;
  gainNode.gain.linearRampToValueAtTime(0, releaseStart + 0.01);

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.start(ctx.currentTime + startOffset);
  oscillator.stop(ctx.currentTime + startOffset + duration);
}

// ─────────────────────────────────────────────────────────────────────────────
// Note frequency constants (Hz)
// ─────────────────────────────────────────────────────────────────────────────

const NOTE = {
  D4:  293.66,
  G4:  392.00,
  A4:  440.00,
  C5:  523.25,
  E5:  659.25,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export interface UseTransactionAudioReturn {
  playSuccess: () => void;
  playWarning: () => void;
  playFailure: () => void;
  isEnabled: boolean;
  toggle: () => void;
}

export function useTransactionAudio(): UseTransactionAudioReturn {
  const [isEnabled, setIsEnabled] = useState<boolean>(readStoredEnabled);

  /**
   * Lazily-initialized AudioContext.  Stored in a ref so it persists across
   * renders without causing re-renders and without being created on mount
   * (which would violate the browser autoplay policy).
   */
  const audioCtxRef = useRef<AudioContext | null>(null);

  /** Returns the shared AudioContext, creating it on first call. */
  const getAudioContext = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    if (!audioCtxRef.current) {
      try {
        audioCtxRef.current = new AudioContext();
      } catch {
        // AudioContext not available (e.g. some sandboxed iframes)
        return null;
      }
    }
    // Resume context if it was suspended (e.g. after a period of inactivity)
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {/* best-effort */});
    }
    return audioCtxRef.current;
  }, []);

  // ── Chime implementations ───────────────────────────────────────────────

  /**
   * Two ascending tones: C5 (80 ms) → E5 (120 ms)
   * Sine wave, gain 0.3
   */
  const playSuccess = useCallback((): void => {
    if (!isEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    scheduleTone(ctx, { frequency: NOTE.C5, duration: 0.08, type: 'sine', gain: 0.3, startOffset: 0 });
    scheduleTone(ctx, { frequency: NOTE.E5, duration: 0.12, type: 'sine', gain: 0.3, startOffset: 0.08 });
  }, [isEnabled, getAudioContext]);

  /**
   * Single mid tone: A4 (200 ms)
   * Triangle wave, gain 0.25
   */
  const playWarning = useCallback((): void => {
    if (!isEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    scheduleTone(ctx, { frequency: NOTE.A4, duration: 0.2, type: 'triangle', gain: 0.25, startOffset: 0 });
  }, [isEnabled, getAudioContext]);

  /**
   * Two descending tones: G4 (100 ms) → D4 (150 ms)
   * Sawtooth wave, gain 0.2
   */
  const playFailure = useCallback((): void => {
    if (!isEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    scheduleTone(ctx, { frequency: NOTE.G4, duration: 0.1,  type: 'sawtooth', gain: 0.2, startOffset: 0 });
    scheduleTone(ctx, { frequency: NOTE.D4, duration: 0.15, type: 'sawtooth', gain: 0.2, startOffset: 0.1 });
  }, [isEnabled, getAudioContext]);

  // ── Toggle ──────────────────────────────────────────────────────────────

  const toggle = useCallback((): void => {
    setIsEnabled((prev) => {
      const next = !prev;
      writeStoredEnabled(next);
      return next;
    });
  }, []);

  return { playSuccess, playWarning, playFailure, isEnabled, toggle };
}
