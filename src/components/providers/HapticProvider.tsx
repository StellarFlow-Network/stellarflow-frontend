'use client';

/**
 * HapticProvider.tsx
 *
 * Global client-side provider and event delegate for mobile haptic feedback.
 * Listens passively to pointer/touch and slider input events across the DOM,
 * automatically triggering crisp tactile pulses on button taps and slider adjustments
 * without requiring boilerplate code on every individual UI component.
 */

import React, { useEffect, type ReactNode } from 'react';
import { triggerHaptic } from '@/lib/haptics';

interface HapticProviderProps {
  children: ReactNode;
}

export function HapticProvider({ children }: HapticProviderProps) {
  useEffect(() => {
    const interactiveSelector =
      'button, [role="button"], a[role="button"], input[type="button"], input[type="submit"], [data-haptic="tap"], summary';

    // 1. Passive pointer/touch handler for button and clickable element taps.
    // Pointer events cover desktop browsers and modern mobile browsers; touchstart
    // remains as a fallback for environments that still dispatch touch-only input.
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      // Ignore elements explicitly marked with data-no-haptic
      if (target.closest('[data-no-haptic="true"]')) {
        return;
      }

      // Check if target or parent is a button or clickable interactive element
      const interactiveEl = target.closest<HTMLElement>(interactiveSelector);

      if (interactiveEl && !interactiveEl.hasAttribute('disabled') && interactiveEl.getAttribute('aria-disabled') !== 'true') {
        triggerHaptic('tap');
      }
    };

    const handleTouchStart = (event: TouchEvent) => {
      handlePointerDown(event as unknown as PointerEvent);
    };

    // 2. Input event handler for slider adjustments
    const handleInput = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      if (target.closest('[data-no-haptic="true"]')) {
        return;
      }

      if (
        (target instanceof HTMLInputElement && target.type === 'range') ||
        target.hasAttribute('data-haptic-slider')
      ) {
        triggerHaptic('slider');
      }
    };

    // Attach passive listeners for maximum scrolling performance
    document.addEventListener('pointerdown', handlePointerDown, { passive: true, capture: true });
    document.addEventListener('touchstart', handleTouchStart, { passive: true, capture: true });
    document.addEventListener('input', handleInput, { passive: true, capture: true });

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      document.removeEventListener('touchstart', handleTouchStart, { capture: true });
      document.removeEventListener('input', handleInput, { capture: true });
    };
  }, []);

  return <>{children}</>;
}
