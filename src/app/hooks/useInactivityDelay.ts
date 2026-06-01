"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface UseInactivityDelayOptions {
  /**
   * Milliseconds of inactivity before the delay multiplier kicks in.
   * @default 180000 (3 minutes)
   */
  inactivityThreshold?: number;
  /**
   * Multiplier applied to polling intervals when the user is active.
   * @default 1
   */
  activeMultiplier?: number;
  /**
   * Multiplier applied to polling intervals when the user is inactive.
   * @default 5
   */
  inactiveMultiplier?: number;
}

export interface UseInactivityDelayReturn {
  /**
   * Current delay multiplier. Equals `activeMultiplier` when the user has
   * interacted recently, `inactiveMultiplier` after `inactivityThreshold` ms
   * of no interaction.
   */
  delayMultiplier: number;
  /**
   * True when the user has been inactive longer than `inactivityThreshold`.
   */
  isInactive: boolean;
}

/**
 * Tracks user interaction (mousedown, keydown, touchstart, scroll, click, wheel)
 * and returns a delay multiplier that grows when the user is idle beyond a
 * configurable threshold.
 *
 * Use this to back off polling intervals for non-critical data when the user
 * is not actively engaging with the page.
 *
 * @example
 * const { delayMultiplier } = useInactivityDelay({ inactivityThreshold: 180000 })
 * useRAFInterval(fetchData, baseInterval * delayMultiplier, enabled)
 */
export function useInactivityDelay(
  options: UseInactivityDelayOptions = {},
): UseInactivityDelayReturn {
  const {
    inactivityThreshold = 3 * 60 * 1000,
    activeMultiplier = 1,
    inactiveMultiplier = 5,
  } = options;

  const [delayMultiplier, setDelayMultiplier] = useState(activeMultiplier);
  const lastActivityRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleInactiveCheck = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDelayMultiplier(inactiveMultiplier);
    }, inactivityThreshold);
  }, [inactivityThreshold, inactiveMultiplier]);

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    setDelayMultiplier(activeMultiplier);
    scheduleInactiveCheck();
  }, [activeMultiplier, scheduleInactiveCheck]);

  // Initialize the inactivity check on mount
  useEffect(() => {
    scheduleInactiveCheck();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [scheduleInactiveCheck]);

  // Bind user-interaction events with a throttle on high-frequency events
  useEffect(() => {
    const events = [
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "click",
      "wheel",
    ] as const;

    let throttleTimer: ReturnType<typeof setTimeout> | null = null;

    const handleActivity = () => {
      if (throttleTimer) return;
      throttleTimer = setTimeout(() => {
        throttleTimer = null;
      }, 500);
      resetActivity();
    };

    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      if (throttleTimer) clearTimeout(throttleTimer);
    };
  }, [resetActivity]);

  return {
    delayMultiplier,
    isInactive: delayMultiplier !== activeMultiplier,
  };
}
