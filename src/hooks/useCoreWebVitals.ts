'use client';

import { useEffect } from 'react';

export interface MetricReport {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
}

export function useCoreWebVitals() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      return;
    }

    try {
      // Observe LCP (Largest Contentful Paint)
      const lcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          const lcpValue = lastEntry.startTime;
          const rating = lcpValue <= 2500 ? 'good' : lcpValue <= 4000 ? 'needs-improvement' : 'poor';
          if (process.env.NODE_ENV === 'development') {
            console.log(`[Core Web Vitals] LCP: ${Math.round(lcpValue)}ms (${rating})`);
          }
        }
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

      // Observe CLS (Cumulative Layout Shift)
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (!(entry as unknown as { hadRecentInput?: boolean }).hadRecentInput) {
            clsValue += (entry as unknown as { value: number }).value;
            const rating = clsValue <= 0.1 ? 'good' : clsValue <= 0.25 ? 'needs-improvement' : 'poor';
            if (process.env.NODE_ENV === 'development') {
              console.log(`[Core Web Vitals] CLS: ${clsValue.toFixed(4)} (${rating})`);
            }
          }
        }
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });

      return () => {
        lcpObserver.disconnect();
        clsObserver.disconnect();
      };
    } catch {
      // Observer API not supported in test environment
    }
  }, []);
}
