/**
 * localStorage persistence for the customizable dashboard (Issue #936).
 *
 * Reads are defensive: a corrupt, foreign, or older-schema payload must never
 * break the dashboard, so `loadLayout` returns `null` and the caller falls
 * back to the default layout.
 */

import { createDefaultLayout, normalizeLayout } from "./layoutState";
import type { DashboardLayoutState } from "./types";

/**
 * Versioned storage key.
 *
 * The existing `stellarflow-dashboard-layout` key (order + visibility, no grid
 * geometry) is left untouched; this grid layout gets its own key so the older
 * customizer keeps working and users do not silently lose either preference.
 */
export const DASHBOARD_LAYOUT_STORAGE_KEY = "stellarflow-dashboard-grid-layout:v1";

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    // Access can throw when storage is disabled (private mode, blocked cookies).
    return null;
  }
}

/** Persist the current layout. Silently no-ops when storage is unavailable. */
export function saveLayout(layout: DashboardLayoutState): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(DASHBOARD_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Quota exceeded or serialization failure: layout stays in memory only.
  }
}

/** Read the stored layout, or `null` when absent/unusable. */
export function loadLayout(): DashboardLayoutState | null {
  const store = storage();
  if (!store) return null;

  let raw: string | null;
  try {
    raw = store.getItem(DASHBOARD_LAYOUT_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    return normalizeLayout(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Remove the stored layout. */
export function clearLayout(): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(DASHBOARD_LAYOUT_STORAGE_KEY);
  } catch {
    // Nothing to do: an undeletable entry is still overwritten on next save.
  }
}

/** Stored layout if valid, otherwise the default layout. */
export function loadLayoutOrDefault(): DashboardLayoutState {
  return loadLayout() ?? createDefaultLayout();
}
