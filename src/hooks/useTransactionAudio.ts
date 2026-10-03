'use client';

/**
 * useTransactionAudio.ts
 *
 * Provides synthesized audio chimes for transaction events using the Web Audio API.
 * Supports multiple sound packs: Minimalist, Retro 8-Bit, Futuristic Synth, and Muted.
 * No external dependencies — all sounds are synthesized at runtime.
 */

import { useCallback, useRef, useState } from 'react';

const ENABLED_STORAGE_KEY = 'sf_audio_enabled';
const PACK_STORAGE_KEY = 'sf_audio_pack';

export type SoundPack = 'minimalist' | 'retro' | 'futuristic' | 'muted';

/** Read the persisted enabled flag (defaults to false = muted). */
function readStoredEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const stored = window.localStorage.getItem(ENABLED_STORAGE_KEY);
    return stored === 'true';
  } catch {
    return false;
  }
}

/** Persist the enabled flag to localStorage. */
function writeStoredEnabled(value: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ENABLED_STORAGE_KEY, String(value));
  } catch {
    // silently ignore
  }
}

/** Read the persisted sound pack (defaults to 'minimalist'). */
function readStoredPack(): SoundPack {
  if (typeof window === 'undefined') return 'minimalist';
  try {
    const stored = window.localStorage.getItem(PACK_STORAGE_KEY) as SoundPack;
    if (['minimalist', 'retro', 'futuristic', 'muted'].includes(stored)) {
      return stored;
    }
    return 'minimalist';
  } catch {
    return 'minimalist';
  }
}

/** Persist the sound pack preference to localStorage. */
function writeStoredPack(value: SoundPack): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PACK_STORAGE_KEY, value);
  } catch {
    // silently ignore
  }
}

type OscillatorType = 'sine' | 'triangle' | 'sawtooth' | 'square';

interface ToneParams {
  frequency: number;
  endFrequency?: number;
  /** Duration in seconds */
  duration: number;
  type: OscillatorType;
  gain: number;
  /** Start time offset in seconds (relative to AudioContext.currentTime) */
  startOffset: number;
}

/** Schedules a single synthesized tone via the Web Audio API. */
function scheduleTone(ctx: AudioContext, params: ToneParams): void {
  const { frequency, endFrequency, duration, type, gain, startOffset } = params;

  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime + startOffset);
  if (endFrequency) {
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, ctx.currentTime + startOffset + duration);
  }

  gainNode.gain.setValueAtTime(gain, ctx.currentTime + startOffset);
  const releaseStart = ctx.currentTime + startOffset + duration - 0.01;
  gainNode.gain.linearRampToValueAtTime(0, releaseStart + 0.01);

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.start(ctx.currentTime + startOffset);
  oscillator.stop(ctx.currentTime + startOffset + duration);
}

const NOTE = {
  C3:  130.81,
  G3:  196.00,
  C4:  261.63,
  D4:  293.66,
  F_sharp_4: 369.99,
  G4:  392.00,
  A4:  440.00,
  C5:  523.25,
  D5:  587.33,
  E5:  659.25,
  G5:  783.99,
  C6:  1046.50,
  G6:  1567.98,
} as const;

export interface UseTransactionAudioReturn {
  playSuccess: () => void;
  playWarning: () => void;
  playFailure: () => void;
  isEnabled: boolean;
  toggle: () => void;
  currentPack: SoundPack;
  setSoundPack: (pack: SoundPack) => void;
  playPreview: (pack: SoundPack) => void;
}

export function useTransactionAudio(): UseTransactionAudioReturn {
  const [isEnabled, setIsEnabled] = useState<boolean>(readStoredEnabled);
  const [currentPack, setCurrentPack] = useState<SoundPack>(readStoredPack);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    if (!audioCtxRef.current) {
      try {
        audioCtxRef.current = new AudioContext();
      } catch {
        return null;
      }
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
    return audioCtxRef.current;
  }, []);

  const playSuccess = useCallback((): void => {
    if (!isEnabled || currentPack === 'muted') return;
    const ctx = getAudioContext();
    if (!ctx) return;

    if (currentPack === 'minimalist') {
      scheduleTone(ctx, { frequency: NOTE.C5, duration: 0.08, type: 'sine', gain: 0.3, startOffset: 0 });
      scheduleTone(ctx, { frequency: NOTE.E5, duration: 0.12, type: 'sine', gain: 0.3, startOffset: 0.08 });
    } else if (currentPack === 'retro') {
      scheduleTone(ctx, { frequency: NOTE.C5, duration: 0.06, type: 'square', gain: 0.15, startOffset: 0 });
      scheduleTone(ctx, { frequency: NOTE.E5, duration: 0.06, type: 'square', gain: 0.15, startOffset: 0.06 });
      scheduleTone(ctx, { frequency: NOTE.G5, duration: 0.12, type: 'square', gain: 0.15, startOffset: 0.12 });
    } else if (currentPack === 'futuristic') {
      scheduleTone(ctx, { frequency: NOTE.C5, endFrequency: NOTE.C6, duration: 0.2, type: 'sawtooth', gain: 0.1, startOffset: 0 });
      scheduleTone(ctx, { frequency: NOTE.G5, endFrequency: NOTE.G6, duration: 0.2, type: 'sine', gain: 0.15, startOffset: 0 });
    }
  }, [isEnabled, currentPack, getAudioContext]);

  const playWarning = useCallback((): void => {
    if (!isEnabled || currentPack === 'muted') return;
    const ctx = getAudioContext();
    if (!ctx) return;

    if (currentPack === 'minimalist') {
      scheduleTone(ctx, { frequency: NOTE.A4, duration: 0.2, type: 'triangle', gain: 0.25, startOffset: 0 });
    } else if (currentPack === 'retro') {
      scheduleTone(ctx, { frequency: NOTE.C4, duration: 0.1, type: 'square', gain: 0.15, startOffset: 0 });
      scheduleTone(ctx, { frequency: NOTE.G4, duration: 0.1, type: 'square', gain: 0.15, startOffset: 0.1 });
    } else if (currentPack === 'futuristic') {
      scheduleTone(ctx, { frequency: NOTE.D5, endFrequency: NOTE.D4, duration: 0.2, type: 'triangle', gain: 0.2, startOffset: 0 });
    }
  }, [isEnabled, currentPack, getAudioContext]);

  const playFailure = useCallback((): void => {
    if (!isEnabled || currentPack === 'muted') return;
    const ctx = getAudioContext();
    if (!ctx) return;

    if (currentPack === 'minimalist') {
      scheduleTone(ctx, { frequency: NOTE.G4, duration: 0.1, type: 'sawtooth', gain: 0.2, startOffset: 0 });
      scheduleTone(ctx, { frequency: NOTE.D4, duration: 0.15, type: 'sawtooth', gain: 0.2, startOffset: 0.1 });
    } else if (currentPack === 'retro') {
      scheduleTone(ctx, { frequency: NOTE.C4, duration: 0.12, type: 'square', gain: 0.15, startOffset: 0 });
      scheduleTone(ctx, { frequency: NOTE.G3, duration: 0.24, type: 'square', gain: 0.15, startOffset: 0.12 });
    } else if (currentPack === 'futuristic') {
      scheduleTone(ctx, { frequency: NOTE.F_sharp_4, endFrequency: NOTE.C3, duration: 0.3, type: 'sawtooth', gain: 0.15, startOffset: 0 });
    }
  }, [isEnabled, currentPack, getAudioContext]);

  const playPreview = useCallback((pack: SoundPack): void => {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (pack === 'minimalist') {
      scheduleTone(ctx, { frequency: NOTE.C5, duration: 0.08, type: 'sine', gain: 0.3, startOffset: 0 });
      scheduleTone(ctx, { frequency: NOTE.E5, duration: 0.12, type: 'sine', gain: 0.3, startOffset: 0.08 });
    } else if (pack === 'retro') {
      scheduleTone(ctx, { frequency: NOTE.C5, duration: 0.06, type: 'square', gain: 0.15, startOffset: 0 });
      scheduleTone(ctx, { frequency: NOTE.E5, duration: 0.06, type: 'square', gain: 0.15, startOffset: 0.06 });
      scheduleTone(ctx, { frequency: NOTE.G5, duration: 0.12, type: 'square', gain: 0.15, startOffset: 0.12 });
    } else if (pack === 'futuristic') {
      scheduleTone(ctx, { frequency: NOTE.C5, endFrequency: NOTE.C6, duration: 0.2, type: 'sawtooth', gain: 0.1, startOffset: 0 });
      scheduleTone(ctx, { frequency: NOTE.G5, endFrequency: NOTE.G6, duration: 0.2, type: 'sine', gain: 0.15, startOffset: 0 });
    }
  }, [getAudioContext]);

  const toggle = useCallback((): void => {
    setIsEnabled((prev) => {
      const next = !prev;
      writeStoredEnabled(next);
      return next;
    });
  }, []);

  const setSoundPack = useCallback((pack: SoundPack): void => {
    setCurrentPack(pack);
    writeStoredPack(pack);
  }, []);

  return {
    playSuccess,
    playWarning,
    playFailure,
    isEnabled,
    toggle,
    currentPack,
    setSoundPack,
    playPreview,
  };
}
