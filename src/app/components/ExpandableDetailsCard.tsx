"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon, ICON_IDS } from "@/components/icons";
import type { IconId } from "@/components/icons";

/**
 * ExpandableDetailsCard — Hardware-accelerated expandable content grid.
 *
 * PERFORMANCE OPTIMIZATION:
 * - Uses transform: scaleY() and opacity for layout-free expansion
 * - Applies will-change: transform containment to isolate animations
 * - Avoids measuring/reflow during expand/collapse actions
 * - Maintains 60fps on high-density grids via GPU acceleration
 *
 * Previous anti-pattern (❌ SLOW):
 * ```tsx
 * animate={{ height: isOpen ? 'auto' : 0 }}
 * transition={{ duration: 0.3 }}
 * // Forces main thread layout recalculation on every frame
 * ```
 *
 * New pattern (✅ FAST):
 * ```tsx
 * animate={{ scaleY: isOpen ? 1 : 0, opacity: isOpen ? 1 : 0 }}
 * style={{ transformOrigin: "top", willChange: "transform" }}
 * // GPU-accelerated, no layout thrashing
 * ```
 */

export interface ExpandableDetailsCardProps {
  title: string;
  icon?: IconId;
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
}

export const ExpandableDetailsCard = React.memo(function ExpandableDetailsCard(
  props: ExpandableDetailsCardProps
) {
  const {
    title,
    icon,
    isOpen,
    onToggle,
    children,
    className = "",
    headerClassName = "",
    contentClassName = "",
  } = props;
  const handleToggle = useCallback(() => {
    onToggle(!isOpen);
  }, [isOpen, onToggle]);

  return (
    <div
      className={`bg-[#161b22] border border-gray-800 rounded-xl overflow-hidden transition-colors hover:border-gray-700 ${className}`}
      style={{ contain: "layout style paint" }}
    >
      {/* ─────────────────────────────────────────────────────────────────────
          Header — Click to toggle
          ───────────────────────────────────────────────────────────────────── */}
      <button
        onClick={handleToggle}
        className={`w-full p-6 flex items-center justify-between cursor-pointer group transition-colors hover:bg-[#1c2128] ${headerClassName}`}
        aria-expanded={isOpen}
        aria-label={`${isOpen ? "Collapse" : "Expand"} ${title}`}
      >
        <div className="flex items-center gap-3">
          {icon && <Icon id={icon} size={18} className="text-gray-500 group-hover:text-gray-300" />}
          <h3 className="text-lg font-semibold text-gray-100 group-hover:text-white transition-colors">
            {title}
          </h3>
        </div>

        {/* Chevron indicator — rotates without layout impact */}
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          style={{ willChange: "transform" }}
        >
          <Icon id={ICON_IDS.chevronRight} size={20} className="text-gray-500" />
        </motion.div>
      </button>

      {/* ─────────────────────────────────────────────────────────────────────
          Content — Hardware-accelerated expand/collapse animation
          ───────────────────────────────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="expandable-content"
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{ scaleY: 1, opacity: 1 }}
            exit={{ scaleY: 0, opacity: 0 }}
            transition={{
              scaleY: { type: "spring", stiffness: 400, damping: 30 },
              opacity: { duration: 0.2 },
            }}
            style={{
              transformOrigin: "top",
              willChange: "transform, opacity",
            }}
          >
            {/* Separator line */}
            <div className="border-t border-gray-800" />

            {/* Content area */}
            <div className={`p-6 ${contentClassName}`}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

ExpandableDetailsCard.displayName = "ExpandableDetailsCard";

/**
 * ExpandableRow — Optimized expandable table row for high-density lists.
 *
 * PERFORMANCE:
 * - Memoized to prevent parent re-renders
 * - Uses transform: scaleY() for expansion animation
 * - Maintains hover state without layout thrashing
 * - Suitable for 100+ row grids
 */

export interface ExpandableRowProps {
  id: string;
  title: string;
  metadata: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const ExpandableRow = React.memo(function ExpandableRow({
  id,
  title,
  metadata,
  children,
  className = "",
}: ExpandableRowProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return (
    <>
      {/* Row header — click target */}
      <tr
        onClick={handleToggle}
        className={`cursor-pointer hover:bg-[#1c2128] transition-colors group ${className}`}
      >
        <td className="px-6 py-4 flex items-center gap-3">
          {/* Chevron indicator */}
          <motion.div
            animate={{ rotate: isOpen ? 90 : 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            style={{ willChange: "transform", display: "flex" }}
          >
            <Icon id={ICON_IDS.chevronRight} size={16} className="text-gray-500" />
          </motion.div>

          <div>
            <div className="font-medium text-gray-200">{title}</div>
            <div className="text-xs text-gray-500 mt-1">{metadata}</div>
          </div>
        </td>
      </tr>

      {/* Expanded details row — hardware-accelerated */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <tr key={`${id}-details`}>
            <td colSpan={10} className="px-0 py-0" style={{ contain: "content" }}>
              <motion.div
                initial={{ scaleY: 0, opacity: 0 }}
                animate={{ scaleY: 1, opacity: 1 }}
                exit={{ scaleY: 0, opacity: 0 }}
                transition={{
                  scaleY: { type: "spring", stiffness: 400, damping: 30 },
                  opacity: { duration: 0.2 },
                }}
                style={{
                  transformOrigin: "top",
                  willChange: "transform, opacity",
                }}
              >
                <div className="bg-[#0d1117] border-t border-gray-800 px-6 py-4">
                  {children}
                </div>
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  );
});

ExpandableRow.displayName = "ExpandableRow";

/**
 * useExpandableState — Lightweight hook for managing expandable section state.
 *
 * Prevents prop drilling and keeps expand/collapse logic isolated from parent.
 */

export interface ExpandableStateMap {
  [key: string]: boolean;
}

export function useExpandableState(
  initialIds: string[] = []
): [ExpandableStateMap, (id: string, open: boolean) => void] {
  const [expanded, setExpanded] = React.useState<ExpandableStateMap>(() =>
    initialIds.reduce(
      (acc, id) => {
        acc[id] = false;
        return acc;
      },
      {} as ExpandableStateMap
    )
  );

  const toggleExpanded = React.useCallback((id: string, open: boolean) => {
    setExpanded((prev) => ({
      ...prev,
      [id]: open,
    }));
  }, []);

  return [expanded, toggleExpanded];
}
