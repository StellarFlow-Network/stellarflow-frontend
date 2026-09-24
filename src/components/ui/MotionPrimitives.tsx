"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function MotionButton({ children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.button
      {...props}
      whileHover={reduceMotion ? undefined : { y: -1 }}
      whileTap={reduceMotion ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={className}
    >
      {children}
    </motion.button>
  );
}

export function MotionCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      whileHover={reduceMotion ? undefined : { y: -2, boxShadow: "0 18px 45px rgba(0, 0, 0, 0.22)" }}
      transition={{ type: "spring", stiffness: 280, damping: 24 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function SuccessConfetti({ show }: { show: boolean }) {
  const reduceMotion = useReducedMotion();
  const pieces = Array.from({ length: 18 }, (_, index) => index);
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-28 overflow-hidden"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {pieces.map((piece) => (
            <span
              key={piece}
              className="stellar-confetti"
              style={{
                left: `${5 + ((piece * 47) % 90)}%`,
                backgroundColor: ["#39ff14", "#60a5fa", "#facc15", "#c084fc"][piece % 4],
                animationDelay: `${piece * 35}ms`,
                transform: `rotate(${piece * 23}deg)`,
              }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
