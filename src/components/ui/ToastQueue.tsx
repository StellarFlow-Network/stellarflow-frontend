"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Icon from "@/components/icons/Icon";
import { ICON_IDS, IconId } from "@/components/icons/iconIds";
import { useTransactionAudio } from "@/hooks/useTransactionAudio";

export type ToastStatus = "submitted" | "processing" | "confirmed" | "failed";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  status: ToastStatus;
  txHash?: string;
  createdAt: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id" | "createdAt">) => string;
  updateToast: (id: string, updates: Partial<Omit<Toast, "id" | "createdAt">>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

/**
 * Same queue as {@link useToast} but returns `null` instead of throwing when no
 * provider is mounted, for globally-mounted UI that should still work — just
 * without notifications — outside the provider tree.
 */
export function useOptionalToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeouts = useRef<Record<string, NodeJS.Timeout>>({});
  const { playSuccess, playFailure } = useTransactionAudio();

  // Play a chime whenever a toast's status transitions to confirmed/failed,
  // tracked outside of setState so the sound is a side effect, not a state
  // update (avoids double-firing under React strict mode).
  const lastPlayedStatus = useRef<Record<string, ToastStatus>>({});
  useEffect(() => {
    for (const toast of toasts) {
      if (lastPlayedStatus.current[toast.id] === toast.status) continue;
      lastPlayedStatus.current[toast.id] = toast.status;
      if (toast.status === "confirmed") playSuccess();
      else if (toast.status === "failed") playFailure();
    }
  }, [toasts, playSuccess, playFailure]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (timeouts.current[id]) {
      clearTimeout(timeouts.current[id]);
      delete timeouts.current[id];
    }
  }, []);

  const addToast = useCallback((toast: Omit<Toast, "id" | "createdAt">) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: Toast = {
      ...toast,
      id,
      createdAt: Date.now(),
    };

    setToasts((prev) => [...prev, newToast]);

    // Auto-dismiss successful (confirmed) toasts after 5 seconds
    if (toast.status === "confirmed") {
      timeouts.current[id] = setTimeout(() => {
        removeToast(id);
      }, 5000);
    }

    return id;
  }, [removeToast]);

  const updateToast = useCallback((id: string, updates: Partial<Omit<Toast, "id" | "createdAt">>) => {
    setToasts((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const updated = { ...t, ...updates };

        // Handle auto-dismissal if status transitions to confirmed
        if (updates.status === "confirmed") {
          if (timeouts.current[id]) clearTimeout(timeouts.current[id]);
          timeouts.current[id] = setTimeout(() => {
            removeToast(id);
          }, 5000);
        }

        return updated;
      })
    );
  }, [removeToast]);

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(timeouts.current).forEach(clearTimeout);
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, updateToast, removeToast }}>
      {children}
      <ToastQueue toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastQueue({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) {
  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 w-full max-w-sm pointer-events-none"
      role="region"
      aria-label="Notifications"
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
            className="pointer-events-auto w-full"
          >
            <ToastCard toast={toast} onClose={() => removeToast(toast.id)} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastCard({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const { title, description, status, txHash } = toast;

  // Visual variants depending on transaction lifecycle status
  let statusColor = "text-blue-400";
  let borderColor = "border-blue-900/40";
  let bgColor = "bg-blue-950/20";
  let iconId: IconId = ICON_IDS.activity;

  if (status === "processing") {
    statusColor = "text-amber-400";
    borderColor = "border-amber-900/40";
    bgColor = "bg-amber-950/20";
    iconId = ICON_IDS.refreshCcw;
  } else if (status === "confirmed") {
    statusColor = "text-emerald-400";
    borderColor = "border-emerald-800/40";
    bgColor = "bg-emerald-950/30";
    iconId = ICON_IDS.checkCircle;
  } else if (status === "failed") {
    statusColor = "text-rose-400";
    borderColor = "border-rose-900/40";
    bgColor = "bg-rose-950/20";
    iconId = ICON_IDS.xCircle;
  }

  const explorerUrl = txHash ? `https://stellar.expert/explorer/testnet/tx/${txHash}` : null;

  return (
    <div
      className={`flex items-start gap-4 p-4 rounded-xl border backdrop-blur-md ${bgColor} ${borderColor} shadow-2xl relative group overflow-hidden`}
    >
      {/* Visual Accent/Glow */}
      <div className={`absolute top-0 left-0 bottom-0 w-1 ${status === "confirmed" ? "bg-emerald-500" : status === "processing" ? "bg-amber-500" : status === "failed" ? "bg-rose-500" : "bg-blue-500"}`} />

      {/* Icon Section */}
      <div className={`shrink-0 p-1.5 rounded-lg ${statusColor} bg-white/5`}>
        <Icon
          id={iconId}
          size={20}
          className={`${status === "processing" ? "animate-spin" : ""}`}
        />
      </div>

      {/* Content Section */}
      <div className="flex-1 min-w-0 pr-4">
        <h4 className="text-sm font-semibold text-white tracking-tight truncate">
          {title}
        </h4>
        {description && (
          <p className="text-xs text-gray-400 mt-1 leading-relaxed break-words">
            {description}
          </p>
        )}

        {/* Explorer Link */}
        {explorerUrl && (
          <div className="mt-2 flex items-center gap-1">
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#CBF34D] hover:underline cursor-pointer"
            >
              <span>View on Stellar Expert</span>
              <Icon id={ICON_IDS.externalLink} size={12} strokeWidth={2.5} />
            </a>
          </div>
        )}
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 text-gray-500 hover:text-gray-300 transition-colors p-1 rounded-md hover:bg-white/5"
        aria-label="Close notification"
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
          <line x1="1" y1="1" x2="13" y2="13"></line>
          <line x1="13" y1="1" x2="1" y2="13"></line>
        </svg>
      </button>
    </div>
  );
}
