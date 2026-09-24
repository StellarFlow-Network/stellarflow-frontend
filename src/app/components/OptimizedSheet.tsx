"use client";

import React, { useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * OptimizedSheet Component
 * 
 * A performant slide-out sheet/panel component that uses conditional rendering
 * to completely remove itself from the DOM when closed.
 * 
 * Key optimizations:
 * - Conditionally rendered: Only exists in DOM when `isOpen` is true
 * - Proper cleanup: Removes event listeners and DOM nodes on unmount
 * - Smooth animations: Uses AnimatePresence for slide-in/out transitions
 * - Keyboard accessible: Supports ESC key to close
 * - Multiple positions: Supports top, right, bottom, left
 */

export interface OptimizedSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  position?: "top" | "right" | "bottom" | "left";
  size?: "sm" | "md" | "lg" | "xl" | "full";
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  className?: string;
}

const getSizeClass = (position: string, size: string) => {
  if (size === "full") {
    return position === "top" || position === "bottom" ? "h-full" : "w-full";
  }

  const sizeMap = {
    sm: { horizontal: "w-80", vertical: "h-80" },
    md: { horizontal: "w-96", vertical: "h-96" },
    lg: { horizontal: "w-[480px]", vertical: "h-[480px]" },
    xl: { horizontal: "w-[640px]", vertical: "h-[640px]" },
  };

  const isVertical = position === "top" || position === "bottom";
  return sizeMap[size as keyof typeof sizeMap][isVertical ? "vertical" : "horizontal"];
};

const getPositionClasses = (position: string) => {
  const positions = {
    top: "top-0 left-0 right-0",
    right: "top-0 right-0 bottom-0",
    bottom: "bottom-0 left-0 right-0",
    left: "top-0 left-0 bottom-0",
  };
  return positions[position as keyof typeof positions];
};

const getAnimationVariants = (position: string) => {
  const variants = {
    top: {
      initial: { y: "-100%" },
      animate: { y: 0 },
      exit: { y: "-100%" },
    },
    right: {
      initial: { x: "100%" },
      animate: { x: 0 },
      exit: { x: "100%" },
    },
    bottom: {
      initial: { y: "100%" },
      animate: { y: 0 },
      exit: { y: "100%" },
    },
    left: {
      initial: { x: "-100%" },
      animate: { x: 0 },
      exit: { x: "-100%" },
    },
  };
  return variants[position as keyof typeof variants];
};

export function OptimizedSheet({
  isOpen,
  onClose,
  title,
  children,
  position = "right",
  size = "md",
  closeOnBackdropClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  className = "",
}: OptimizedSheetProps) {
  // Handle ESC key press
  const handleEscape = useCallback(
    (event: KeyboardEvent) => {
      if (closeOnEscape && event.key === "Escape") {
        onClose();
      }
    },
    [closeOnEscape, onClose]
  );

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (closeOnBackdropClick && event.target === event.currentTarget) {
        onClose();
      }
    },
    [closeOnBackdropClick, onClose]
  );

  // Add/remove ESC listener - only when sheet is open
  useEffect(() => {
    if (isOpen && closeOnEscape) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, closeOnEscape, handleEscape]);

  // Prevent body scroll when sheet is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  const sizeClass = getSizeClass(position, size);
  const positionClasses = getPositionClasses(position);
  const animationVariants = getAnimationVariants(position);

  return (
    <AnimatePresence>
      {/* Only render when isOpen is true - completely removed from DOM otherwise */}
      {isOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleBackdropClick}
          />

          {/* Sheet content */}
          <motion.div
            className={`fixed ${positionClasses} ${sizeClass} bg-[#0d1117] border-gray-800 shadow-2xl ${className}`}
            style={{
              borderWidth:
                position === "right"
                  ? "0 0 0 1px"
                  : position === "left"
                    ? "0 1px 0 0"
                    : position === "top"
                      ? "0 0 1px 0"
                      : "1px 0 0 0",
            }}
            initial={animationVariants.initial}
            animate={animationVariants.animate}
            exit={animationVariants.exit}
            transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 30 }}
          >
            <div className="flex h-full flex-col">
              {/* Header */}
              {(title || showCloseButton) && (
                <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
                  {title && (
                    <h2 className="text-lg font-semibold text-gray-100">{title}</h2>
                  )}
                  {showCloseButton && (
                    <button
                      onClick={onClose}
                      className="ml-auto p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors"
                      aria-label="Close panel"
                    >
                      <X size={20} />
                    </button>
                  )}
                </div>
              )}

              {/* Body - scrollable */}
              <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/**
 * Example usage:
 * 
 * function MyComponent() {
 *   const [isPanelOpen, setIsPanelOpen] = useState(false);
 * 
 *   return (
 *     <>
 *       <button onClick={() => setIsPanelOpen(true)}>
 *         Open Admin Panel
 *       </button>
 * 
 *       <OptimizedSheet
 *         isOpen={isPanelOpen}
 *         onClose={() => setIsPanelOpen(false)}
 *         title="Admin Settings"
 *         position="right"
 *         size="lg"
 *       >
 *         <AdminSettingsForm />
 *       </OptimizedSheet>
 *     </>
 *   );
 * }
 */

export default OptimizedSheet;
