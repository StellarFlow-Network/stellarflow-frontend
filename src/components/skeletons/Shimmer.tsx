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
      <div className="absolute inset-0 shimmer-gradient" />
    </div>
  );
}
