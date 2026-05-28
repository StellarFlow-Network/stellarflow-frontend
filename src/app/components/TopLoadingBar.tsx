"use client";

import React, { createContext, useContext, useCallback, useRef, useState } from "react";
import { useRAFInterval } from "@/app/hooks/useRAFInterval";

// ─── Context ──────────────────────────────────────────────────────────────────

interface ProgressBarContextValue {
  start: () => void;
  done: () => void;
}

const ProgressBarContext = createContext<ProgressBarContextValue | null>(null);

export function useProgressBar() {
  const ctx = useContext(ProgressBarContext);
  if (!ctx) throw new Error("useProgressBar must be used inside ProgressBarProvider");
  return ctx;
}

// ─── Trickle bar — isolated so the RAF hook runs unconditionally ──────────────

function TrickleBar({ width }: { width: number }) {
  return (
    <div
      role="progressbar"
      aria-label="Loading"
      aria-valuenow={width}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        height: "3px",
        width: `${width}%`,
        background: "linear-gradient(90deg, #99DC1B, #39FF14)",
        boxShadow: "0 0 8px rgba(153,220,27,0.7)",
        transition: width === 100 ? "width 0.2s ease-out" : "width 0.12s linear",
        zIndex: 9999,
        borderRadius: "0 2px 2px 0",
      }}
    />
  );
}

// ─── Provider + Bar ───────────────────────────────────────────────────────────

export function ProgressBarProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  // Tracks trickle progress across RAF ticks without triggering re-renders
  const currentRef = useRef(0);
  const trickling = useRef(false);

  const stop = useCallback(() => {
    trickling.current = false;
  }, []);

  const start = useCallback(() => {
    stop();
    currentRef.current = 0;
    setWidth(0);
    setVisible(true);
    trickling.current = true;
  }, [stop]);

  const done = useCallback(() => {
    stop();
    setWidth(100);
    setTimeout(() => {
      setVisible(false);
      setWidth(0);
    }, 400);
  }, [stop]);

  // Single RAF-backed trickle tick at 120 ms — replaces setInterval
  useRAFInterval(
    useCallback(() => {
      if (!trickling.current) return;
      const c = currentRef.current;
      const next = Math.min(c + (c < 30 ? 8 : c < 60 ? 4 : c < 80 ? 1.5 : 0.5), 85);
      currentRef.current = next;
      setWidth(next);
    }, []),
    120,
  );

  return (
    <ProgressBarContext.Provider value={{ start, done }}>
      {visible && <TrickleBar width={width} />}
      {children}
    </ProgressBarContext.Provider>
  );
}
