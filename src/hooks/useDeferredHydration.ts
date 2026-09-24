'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

interface UseDeferredHydrationOptions {
  /** Delay in ms after layout mount before hydrating (default: 0) */
  delay?: number;
  /** Whether to wait for requestIdleCallback before hydrating */
  waitForIdle?: boolean;
  /** Timeout for requestIdleCallback in ms (default: 2000) */
  idleTimeout?: number;
}

/**
 * Deferred hydration hook that delays client-side hydration of heavy components
 * until after initial layout mount tasks have settled.
 * 
 * This improves First Input Delay (FID) by keeping the main thread free
 * during the critical initial render phase.
 */
export function useDeferredHydration(options: UseDeferredHydrationOptions = {}) {
  const { delay = 0, waitForIdle = true, idleTimeout = 2000 } = options;
  const [shouldHydrate, setShouldHydrate] = useState(false);
  const hasHydrated = useRef(false);

  const triggerHydration = useCallback(() => {
    if (hasHydrated.current) return;
    hasHydrated.current = true;
    setShouldHydrate(true);
  }, []);

  useEffect(() => {
    // Use double requestAnimationFrame to ensure layout paint has settled
    let rafId1: number;
    let rafId2: number;
    let timeoutId: ReturnType<typeof setTimeout>;
    let idleCallbackId: number;

    const scheduleHydration = () => {
      if (delay > 0) {
        timeoutId = setTimeout(triggerHydration, delay);
      } else if (waitForIdle && typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        idleCallbackId = window.requestIdleCallback(
          () => triggerHydration(),
          { timeout: idleTimeout }
        );
      } else {
        triggerHydration();
      }
    };

    // Wait for two animation frames to ensure layout is stable
    rafId1 = requestAnimationFrame(() => {
      rafId2 = requestAnimationFrame(() => {
        scheduleHydration();
      });
    });

    return () => {
      cancelAnimationFrame(rafId1);
      cancelAnimationFrame(rafId2);
      clearTimeout(timeoutId);
      if (typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleCallbackId);
      }
    };
  }, [delay, waitForIdle, idleTimeout, triggerHydration]);

  return shouldHydrate;
}

/**
 * Hook that returns true when the component should render its heavy children.
 * Combines deferred hydration with Intersection Observer for viewport-based loading.
 */
export function useDeferredHydrationWithViewport(
  options: UseDeferredHydrationOptions & {
    /** Root margin for intersection observer */
    rootMargin?: string;
    /** Whether to require viewport intersection before hydrating */
    requireIntersection?: boolean;
  } = {}
) {
  const {
    delay = 0,
    waitForIdle = true,
    idleTimeout = 2000,
    rootMargin = '100px',
    requireIntersection = false,
  } = options;

  const [isInViewport, setIsInViewport] = useState(!requireIntersection);
  const [isHydrationReady, setIsHydrationReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasHydrated = useRef(false);

  // Deferred hydration timing
  useEffect(() => {
    let rafId1: number;
    let rafId2: number;
    let timeoutId: ReturnType<typeof setTimeout>;
    let idleCallbackId: number;

    const triggerHydration = () => {
      if (hasHydrated.current) return;
      hasHydrated.current = true;
      setIsHydrationReady(true);
    };

    const scheduleHydration = () => {
      if (delay > 0) {
        timeoutId = setTimeout(triggerHydration, delay);
      } else if (waitForIdle && typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        idleCallbackId = window.requestIdleCallback(
          () => triggerHydration(),
          { timeout: idleTimeout }
        );
      } else {
        triggerHydration();
      }
    };

    rafId1 = requestAnimationFrame(() => {
      rafId2 = requestAnimationFrame(() => {
        scheduleHydration();
      });
    });

    return () => {
      cancelAnimationFrame(rafId1);
      cancelAnimationFrame(rafId2);
      clearTimeout(timeoutId);
      if (typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleCallbackId);
      }
    };
  }, [delay, waitForIdle, idleTimeout]);

  // Intersection Observer for viewport-based loading
  useEffect(() => {
    if (!requireIntersection) return;

    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [requireIntersection, rootMargin]);

  return {
    shouldRender: isHydrationReady && isInViewport,
    containerRef,
    isHydrationReady,
    isInViewport,
  };
}