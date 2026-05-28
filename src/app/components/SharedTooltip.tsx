"use client";

import { useEffect, useState } from "react";

type TooltipState = {
  visible: boolean;
  text: string;
  x: number;
  y: number;
};

export default function SharedTooltip() {
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    text: "",
    x: 0,
    y: 0,
  });

  useEffect(() => {
    const getTrigger = (event: Event) => {
      const target = event.target as HTMLElement | null;
      return target?.closest<HTMLElement>("[data-tooltip]") ?? null;
    };

    const showTooltip = (event: Event) => {
      const trigger = getTrigger(event);
      if (!trigger?.dataset.tooltip) return;

      const rect = trigger.getBoundingClientRect();

      setTooltip({
        visible: true,
        text: trigger.dataset.tooltip,
        x: rect.left + rect.width / 2,
        y: rect.top - 10,
      });
    };

    const hideTooltip = () => {
      setTooltip((current) => ({ ...current, visible: false }));
    };

    document.addEventListener("mouseover", showTooltip);
    document.addEventListener("focusin", showTooltip);
    document.addEventListener("mouseout", hideTooltip);
    document.addEventListener("focusout", hideTooltip);

    return () => {
      document.removeEventListener("mouseover", showTooltip);
      document.removeEventListener("focusin", showTooltip);
      document.removeEventListener("mouseout", hideTooltip);
      document.removeEventListener("focusout", hideTooltip);
    };
  }, []);

  if (!tooltip.visible) return null;

  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-[9999] max-w-xs -translate-x-1/2 -translate-y-full rounded-md border border-white/10 bg-[#0A0F1E] px-3 py-2 text-xs text-white shadow-xl"
      style={{ left: tooltip.x, top: tooltip.y }}
    >
      {tooltip.text}
    </div>
  );
}
