"use client";

/**
 * src/components/glass/GlassModal.tsx
 *
 * Accessible glass dialog shell. Mirrors the behaviour of
 * `src/app/components/OptimizedDialog.tsx` (ESC to close, backdrop click to
 * close, body scroll lock, conditional rendering) but paints the surface with
 * the glass preset instead of a flat background.
 *
 * Like every other glass surface, the panel renders an opaque fallback and only
 * enables `backdrop-filter` when the engine supports it.
 */

import React, { useCallback, useEffect, useId } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

import {
  buildGlassStyle,
  resolveGlassClassName,
  splitGlassProps,
  type GlassTuning,
} from "./glassTheme";

export interface GlassModalProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">,
    GlassTuning {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
}

const sizeClasses: Record<NonNullable<GlassModalProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
};

export function GlassModal({
  isOpen,
  onClose,
  title,
  size = "md",
  closeOnBackdropClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  className,
  style,
  children,
  ...rest
}: GlassModalProps) {
  const titleId = useId();
  const { glass, rest: domProps } = splitGlassProps(rest);

  const handleEscape = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    },
    [onClose],
  );

  const handleBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, closeOnEscape, handleEscape]);

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
        >
          {/* Scrim */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeOnBackdropClick ? handleBackdropClick : undefined}
          />

          {/* Glass panel */}
          <motion.div
            {...domProps}
            data-glass-variant="modal"
            className={resolveGlassClassName({
              variant: "modal",
              className: `relative w-full ${sizeClasses[size]} rounded-2xl border ${className ?? ""}`,
            })}
            style={{ ...buildGlassStyle(glass), ...style }}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{
              duration: 0.2,
              type: "spring",
              stiffness: 300,
              damping: 30,
            }}
          >
            {(title || showCloseButton) && (
              <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
                {title ? (
                  <h2
                    id={titleId}
                    className="text-lg font-semibold text-foreground"
                  >
                    {title}
                  </h2>
                ) : null}
                {showCloseButton && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="ml-auto rounded-lg p-1.5 text-foreground/60 transition-colors hover:bg-white/10 hover:text-foreground"
                    aria-label="Close dialog"
                  >
                    <X size={20} />
                  </button>
                )}
              </div>
            )}

            <div className="px-6 py-4">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default GlassModal;
