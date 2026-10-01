"use client";

import { motion, AnimatePresence } from "framer-motion";

export type BiometricState = "idle" | "scanning" | "success" | "error";

interface BiometricAnimationProps {
  state?: BiometricState;
  /** Size of the outer container in pixels. Default 96. */
  size?: number;
  className?: string;
}

/**
 * Animated fingerprint / biometric graphic shown during passkey challenge
 * verification.  Transitions between idle, scanning (pulsing ring + scan
 * line), success (green fill), and error (red shake) states.
 */
export function BiometricAnimation({
  state = "idle",
  size = 96,
  className = "",
}: BiometricAnimationProps) {
  const cx = size / 2;
  const cy = size / 2;

  const colorMap: Record<BiometricState, string> = {
    idle: "#6B7280",      // gray-500
    scanning: "#3B82F6",  // blue-500
    success: "#22C55E",   // green-500
    error: "#EF4444",     // red-500
  };

  const color = colorMap[state];
  const ringColor = state === "error" ? "#FCA5A5" : state === "success" ? "#86EFAC" : "#93C5FD";

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      aria-label={
        state === "scanning"
          ? "Verifying biometric…"
          : state === "success"
          ? "Biometric verified"
          : state === "error"
          ? "Biometric failed"
          : "Biometric prompt"
      }
      role="img"
    >
      {/* Outer pulse ring — visible during scanning and on completion */}
      <AnimatePresence>
        {(state === "scanning" || state === "success" || state === "error") && (
          <motion.span
            key="pulse-ring"
            className="absolute inset-0 rounded-full"
            style={{ border: `2px solid ${ringColor}` }}
            initial={{ opacity: 0.8, scale: 0.9 }}
            animate={
              state === "scanning"
                ? { opacity: [0.8, 0.2, 0.8], scale: [0.9, 1.15, 0.9] }
                : { opacity: 0.6, scale: 1.05 }
            }
            exit={{ opacity: 0, scale: 1.2 }}
            transition={
              state === "scanning"
                ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
                : { duration: 0.3 }
            }
          />
        )}
      </AnimatePresence>

      {/* Error shake wrapper */}
      <motion.div
        animate={state === "error" ? { x: [-6, 6, -4, 4, 0] } : { x: 0 }}
        transition={state === "error" ? { duration: 0.4, ease: "easeInOut" } : {}}
      >
        <svg
          width={size * 0.75}
          height={size * 0.75}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          {/* ---- Fingerprint ridge paths (SVG arc arcs approximating ridges) ---- */}

          {/* Outermost arc */}
          <motion.path
            d="M6 28 C6 16 16 8 24 8 C32 8 42 16 42 28"
            stroke={color}
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.6, delay: 0 }}
          />
          {/* Second arc */}
          <motion.path
            d="M10 30 C10 20 16 13 24 13 C32 13 38 20 38 30"
            stroke={color}
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          />
          {/* Third arc */}
          <motion.path
            d="M14 32 C14 24 18 18 24 18 C30 18 34 24 34 32"
            stroke={color}
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          />
          {/* Fourth arc */}
          <motion.path
            d="M18 34 C18 28 20 23 24 23 C28 23 30 28 30 34"
            stroke={color}
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          />
          {/* Core dot */}
          <motion.circle
            cx={cx}
            cy={28}
            r="2.5"
            fill={color}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3, delay: 0.4, type: "spring" }}
          />

          {/* Vertical ridge lines at base */}
          <motion.path
            d="M24 31 L24 40"
            stroke={color}
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.4, delay: 0.35 }}
          />
          <motion.path
            d="M19 35 L19 42"
            stroke={color}
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.35, delay: 0.45 }}
          />
          <motion.path
            d="M29 35 L29 42"
            stroke={color}
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.35, delay: 0.45 }}
          />

          {/* Scan line — only during scanning state */}
          <AnimatePresence>
            {state === "scanning" && (
              <motion.rect
                key="scanline"
                x="4"
                y="8"
                width="40"
                height="2"
                rx="1"
                fill={color}
                fillOpacity="0.7"
                initial={{ y: 8 }}
                animate={{ y: [8, 42, 8] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
              />
            )}
          </AnimatePresence>

          {/* Success check overlay */}
          <AnimatePresence>
            {state === "success" && (
              <motion.path
                key="check"
                d="M16 24 L22 30 L32 18"
                stroke="#22C55E"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            )}
          </AnimatePresence>

          {/* Error X overlay */}
          <AnimatePresence>
            {state === "error" && (
              <>
                <motion.path
                  key="x1"
                  d="M16 16 L32 32"
                  stroke="#EF4444"
                  strokeWidth="3"
                  strokeLinecap="round"
                  fill="none"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                />
                <motion.path
                  key="x2"
                  d="M32 16 L16 32"
                  stroke="#EF4444"
                  strokeWidth="3"
                  strokeLinecap="round"
                  fill="none"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, delay: 0.1 }}
                />
              </>
            )}
          </AnimatePresence>
        </svg>
      </motion.div>
    </div>
  );
}
