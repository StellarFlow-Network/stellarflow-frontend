"use client";

import React from 'react';

/**
 * Base shimmer animation used by all skeleton components.
 * Renders a lightweight CSS-based shimmer for inline loading placeholders.
 */
export function Shimmer({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded ${className}`}
      style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)',
          animation: 'shimmer 1.4s linear infinite',
          willChange: 'transform',
        }}
      />
    </div>
  );
}
