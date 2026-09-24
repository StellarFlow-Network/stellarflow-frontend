"use client";

import { Accessibility } from "lucide-react";
import { useAccessibilityContext } from "@/context/AccessibilityContext";

export function AccessibilityToggle() {
  const { highContrast, toggleHighContrast } = useAccessibilityContext();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={highContrast}
      aria-label="High-contrast colors"
      title="High-contrast colors"
      onClick={toggleHighContrast}
      className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-2.5 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-zinc-800 focus-visible:outline-none"
    >
      <Accessibility size={18} aria-hidden="true" />
      <span className="hidden lg:inline">Contrast</span>
      <span
        aria-hidden="true"
        className={`relative h-4 w-7 rounded-full border border-current ${highContrast ? "bg-yellow-300 text-black" : "bg-zinc-700 text-slate-400"}`}
      >
        <span
          className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-current transition-transform ${highContrast ? "translate-x-3.5" : "translate-x-0.5"}`}
        />
      </span>
    </button>
  );
}