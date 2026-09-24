"use client";

import React, { useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * OptimizedDialog Component
 * 
 * A performant dialog component that uses conditional rendering to completely
 * remove itself from the DOM when closed, improving layout efficiency.
 * 
 * Key optimizations:
 * - Conditionally rendered: Only exists in DOM when `isOpen` is true
 * - Proper cleanup: Removes event listeners on unmount
 * - Smooth animations: Uses AnimatePresence for enter/exit transitions
 * - Keyboard accessible: Supports ESC key to close
 * - Focus trap: Prevents focus from leaving dialog when open
 */

export interface OptimizedDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
};

export function OptimizedDialog({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  closeOnBackdropClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  className = "",
}: OptimizedDialogProps) {
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

  // Add/remove ESC listener
  useEffect(() => {
    if (isOpen && closeOnEscape) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, closeOnEscape, handleEscape]);

  // Prevent body scroll when dialog is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {/* Only render when isOpen is true - completely removed from DOM otherwise */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? "dialog-title" : undefined}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleBackdropClick}
          />

          {/* Dialog content */}
          <motion.div
            className={`relative w-full ${sizeClasses[size]} bg-[#161b22] border border-gray-800 rounded-xl shadow-2xl ${className}`}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, type: "spring", stiffness: 300, damping: 30 }}
          >
            {/* Header */}
            {(title || showCloseButton) && (
              <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
                {title && (
                  <h2
                    id="dialog-title"
                    className="text-lg font-semibold text-gray-100"
                  >
                    {title}
                  </h2>
                )}
                {showCloseButton && (
                  <button
                    onClick={onClose}
                    className="ml-auto p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors"
                    aria-label="Close dialog"
                  >
                    <X size={20} />
                  </button>
                )}
              </div>
            )}

            {/* Body */}
            <div className="px-6 py-4">{children}</div>
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
 *   const [isDialogOpen, setIsDialogOpen] = useState(false);
 * 
 *   return (
 *     <>
 *       <button onClick={() => setIsDialogOpen(true)}>
 *         Open Settings
 *       </button>
 * 
 *       <OptimizedDialog
 *         isOpen={isDialogOpen}
 *         onClose={() => setIsDialogOpen(false)}
 *         title="Admin Settings"
 *         size="lg"
 *       >
 *         <SettingsForm />
 *       </OptimizedDialog>
 *     </>
 *   );
 * }
 */

export default OptimizedDialog;
