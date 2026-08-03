"use client";

import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type PageTransitionProps = {
  children: ReactNode;
  className?: string;
};

type AnimatedActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  className?: string;
};

const getTransition = (shouldReduceMotion: boolean) => ({
  duration: shouldReduceMotion ? 0 : 0.24,
  ease: [0.22, 1, 0.36, 1] as const,
});

export function PageTransition({ children, className }: PageTransitionProps) {
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();

  const variants: Variants = {
    initial: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : 12,
      filter: shouldReduceMotion ? "blur(0px)" : "blur(4px)",
    },
    animate: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
    },
    exit: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : -8,
      filter: shouldReduceMotion ? "blur(0px)" : "blur(4px)",
    },
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname ?? "page"}
        className={className ?? "w-full"}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={variants}
        transition={getTransition(shouldReduceMotion)}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export function AnimatedActionButton({
  children,
  className,
  type = "button",
  ...props
}: AnimatedActionButtonProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.button
      type={type}
      className={className}
      whileHover={shouldReduceMotion ? undefined : { y: -2, scale: 1.01 }}
      whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
      transition={getTransition(shouldReduceMotion)}
      {...props}
    >
      {children}
    </motion.button>
  );
}
