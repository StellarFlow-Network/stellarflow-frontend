"use client";

import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";

export const PRIVACY_STORAGE_KEY = "stellarflow:privacy-mode";

export function PrivacyToggle() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    try {
      setHidden(window.localStorage.getItem(PRIVACY_STORAGE_KEY) === "true");
    } catch {
      // Storage can be unavailable in hardened browser contexts.
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.shiftKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setHidden((current) => !current);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.privacyMode = hidden ? "hidden" : "visible";
    try {
      window.localStorage.setItem(PRIVACY_STORAGE_KEY, String(hidden));
    } catch {
      // Continue with the in-memory preference when storage is blocked.
    }
    return () => {
      delete document.documentElement.dataset.privacyMode;
    };
  }, [hidden]);

  return (
    <button
      type="button"
      aria-pressed={hidden}
      aria-label={hidden ? "Show portfolio values" : "Hide portfolio values"}
      title={`${hidden ? "Show" : "Hide"} portfolio values (Shift+P)`}
      onClick={() => setHidden((current) => !current)}
      className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-3 py-2 text-sm text-slate-200 transition-colors hover:bg-zinc-800"
    >
      {hidden ? <EyeOff size={17} /> : <Eye size={17} />}
      <span className="hidden sm:inline">{hidden ? "Show values" : "Hide values"}</span>
    </button>
  );
}

export function PrivacyPlaceholder() {
  return <span aria-label="Hidden value">••••••</span>;
}
