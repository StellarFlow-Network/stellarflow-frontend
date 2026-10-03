"use client";

/**
 * MotionWrapper.tsx
 *
 * A thin wrapper around framer-motion's `motion.div` used only for
 * staggered entry animations on non-critical UI regions. This file is
 * intentionally kept in its own chunk so that framer-motion is NOT part of
 * the initial JS bundle — it is lazily loaded via `next/dynamic` in the
 * consuming component (DashboardInteractive.tsx).
 */

import React from "react";
import { motion } from "framer-motion";

interface MotionFadeInProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

/**
 * Simple fade-in + upward slide entry animation, used for rate cards and
 * the network map. Only loaded after the main interactive content has mounted.
 */
export function MotionFadeIn({
  children,
  className,
  delay = 0,
}: MotionFadeInProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 100 }}
    >
      {children}
    </motion.div>
  );
}

interface MotionMapRevealProps {
  children: React.ReactNode;
}

/**
 * Scale + fade reveal used for the network map section.
 */
export function MotionMapReveal({ children }: MotionMapRevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
    >
      {children}
    </motion.div>
  );
}
