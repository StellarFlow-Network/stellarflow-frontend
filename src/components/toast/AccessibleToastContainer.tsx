"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef } from "react";
import type {
  AccessibleToastContainerProps,
  ToastItem,
} from "./AccessibleToastContainer.types";
import styles from "./AccessibleToastContainer.module.css";

const DEFAULT_MAX_VISIBLE = 3;
const SWIPE_DISTANCE_PX = 96;
const SWIPE_VELOCITY_PX_PER_SECOND = 700;

function liveRegionFor(kind: ToastItem["kind"]): "polite" | "assertive" {
  return kind === "error" ? "assertive" : "polite";
}

export function AccessibleToastContainer({
  toasts,
  onDismiss,
  maxVisible = DEFAULT_MAX_VISIBLE,
  position = "bottom-right",
}: AccessibleToastContainerProps) {
  const shouldReduceMotion = useReducedMotion();
  const visibleToasts = useMemo(
    () => toasts.slice(-Math.max(1, maxVisible)),
    [maxVisible, toasts],
  );
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const activeIds = new Set(visibleToasts.map((toast) => toast.id));

    for (const [id, timer] of timers.current) {
      if (!activeIds.has(id)) {
        clearTimeout(timer);
        timers.current.delete(id);
      }
    }

    for (const toast of visibleToasts) {
      if (toast.durationMs && toast.durationMs > 0 && !timers.current.has(toast.id)) {
        timers.current.set(
          toast.id,
          setTimeout(() => {
            timers.current.delete(toast.id);
            onDismiss(toast.id);
          }, toast.durationMs),
        );
      }
    }

    return () => {
      for (const timer of timers.current.values()) clearTimeout(timer);
      timers.current.clear();
    };
  }, [onDismiss, visibleToasts]);

  return (
    <section
      className={`${styles.container} ${styles[position.replace("-", "")]}`}
      aria-label="Notifications"
      data-testid="toast-container"
    >
      <AnimatePresence initial={false}>
        {visibleToasts.map((toast) => (
          <motion.article
            key={toast.id}
            className={`${styles.toast} ${styles[toast.kind]}`}
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 120 }}
            transition={{ duration: shouldReduceMotion ? 0.08 : 0.18 }}
            drag="x"
            dragDirectionLock
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ left: 0.05, right: 0.85 }}
            onDragEnd={(_, info) => {
              const swiped =
                info.offset.x >= SWIPE_DISTANCE_PX ||
                info.velocity.x >= SWIPE_VELOCITY_PX_PER_SECOND;

              if (info.offset.x > 0 && swiped) onDismiss(toast.id);
            }}
            role={toast.kind === "error" ? "alert" : "status"}
            aria-live={liveRegionFor(toast.kind)}
            aria-atomic="true"
            tabIndex={-1}
          >
            <div className={styles.content}>
              {toast.title ? <strong>{toast.title}</strong> : null}
              <p>{toast.message}</p>
            </div>

            <button
              type="button"
              className={styles.dismiss}
              aria-label={`Dismiss notification${toast.title ? `: ${toast.title}` : ""}`}
              onClick={() => onDismiss(toast.id)}
            >
              ×
            </button>
          </motion.article>
        ))}
      </AnimatePresence>
    </section>
  );
}
