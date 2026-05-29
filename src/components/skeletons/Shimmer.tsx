"use client";

import { motion } from 'framer-motion';
import React from 'react';

/**
 * Base shimmer animation used by all skeleton components.
 * Renders a light-to-dark-to-light sweep using framer-motion.
 */
export const Shimmer = React.memo(function Shimmer({ className = "" }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded ${className}`}
         style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)',
        }}
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
});
