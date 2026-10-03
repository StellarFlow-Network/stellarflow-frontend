"use client";

import { useState, useCallback } from "react";
import { DashboardWidgetCustomizer } from "./DashboardWidgetCustomizer";

export function useDashboardCustomizer() {
  const [isOpen, setIsOpen] = useState(false);

  const openCustomizer = useCallback(() => setIsOpen(true), []);
  const closeCustomizer = useCallback(() => setIsOpen(false), []);

  return {
    isOpen,
    openCustomizer,
    closeCustomizer,
    Customizer: () => (
      <DashboardWidgetCustomizer isOpen={isOpen} onClose={closeCustomizer} />
    ),
  };
}