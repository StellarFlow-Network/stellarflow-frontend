"use client";

import { useState, useEffect, useRef } from "react";
import { useRafThrottle } from "./useRafThrottle";

export interface WindowSize {
  width: number;
  height: number;
}

/**
 * useWindowSize
 * 
 * Hook-Tuning | Isolating State Intercept Triggers inside Window Watchers
 * 
 * Triggering layout updates on every individual window resize pixel shift overloads 
 * component state, leading to noticeable interface lag. This hook wraps window 
 * resize tracking loops within a tight execution throttle window handler, and 
 * updates structural values only after resize interactions settle to protect 
 * component performance.
 */
export function useWindowSize(settleDelay = 150): WindowSize {
  const [size, setSize] = useState<WindowSize>({
    width: typeof window !== "undefined" ? window.innerWidth : 0,
    height: typeof window !== "undefined" ? window.innerHeight : 0,
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Wrap window resize tracking loops within a tight execution throttle window handler.
  const throttledResizeHandler = useRafThrottle(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    
    // Update structural values only after resize interactions settle
    timerRef.current = setTimeout(() => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
      timerRef.current = null;
    }, settleDelay);
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    window.addEventListener("resize", throttledResizeHandler, { passive: true });
    
    // Set initial size without delay
    setSize({
      width: window.innerWidth,
      height: window.innerHeight,
    });

    return () => {
      window.removeEventListener("resize", throttledResizeHandler);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [throttledResizeHandler, settleDelay]);

  return size;
}
