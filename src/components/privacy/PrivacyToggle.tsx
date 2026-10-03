"use client";

import { Eye, EyeOff } from "lucide-react";
import { useBalancePrivacy } from "@/context/BalancePrivacyContext";

export function PrivacyToggle() {
  const { hidden, toggle } = useBalancePrivacy();
  return <button
    type="button"
    aria-pressed={hidden}
    aria-label={hidden ? "Show balances" : "Hide balances"}
    title={`${hidden ? "Show" : "Hide"} balances (Shift+H)`}
    onClick={toggle}
    className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-3 py-2 text-sm text-slate-200 transition-colors hover:bg-zinc-800"
  >
    {hidden ? <EyeOff size={17} /> : <Eye size={17} />}
    <span className="hidden sm:inline">{hidden ? "Show balances" : "Hide balances"}</span>
  </button>;
}

export { BalanceValue as PrivacyPlaceholder } from "@/context/BalancePrivacyContext";
export const PRIVACY_STORAGE_KEY = "stellarflow:balance-privacy";
