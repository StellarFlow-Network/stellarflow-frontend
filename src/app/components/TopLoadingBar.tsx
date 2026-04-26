"use client";

import React, { createContext, useContext, useCallback, useRef, useState } from "react";

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

// ─── Provider + Bar ───────────────────────────────────────────────────────────

export function ProgressBarProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const start = useCallback(() => {
    clearTimer();
    doneRef.current = false;
    setWidth(0);
    setVisible(true);

    // Trickle: quickly to ~30%, then slow down toward 85%
    let current = 0;
    timerRef.current = setInterval(() => {
      current += current < 30 ? 8 : current < 60 ? 4 : current < 80 ? 1.5 : 0.5;
      if (current >= 85) current = 85;
      setWidth(current);
    }, 120);
  }, []);

  const done = useCallback(() => {
    clearTimer();
    doneRef.current = true;
    setWidth(100);
    // Hide after the fill animation completes
    setTimeout(() => {
      setVisible(false);
      setWidth(0);
    }, 400);
  }, []);

  return (
    <ProgressBarContext.Provider value={{ start, done }}>
      {visible && (
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
      )}
      {children}
    </ProgressBarContext.Provider>
  );
}
