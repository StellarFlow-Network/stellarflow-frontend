"use client";

/**
 * `/dashboard/widgets` — hosts the customizable widget grid (Issue #936).
 *
 * The grid is loaded with `next/dynamic` and `ssr: false` for two reasons:
 * react-grid-layout needs a measured container width, and keeping it out of the
 * initial payload protects the bundle budgets in `.bundle-limits.json`.
 */

import dynamic from "next/dynamic";

const CustomizableDashboard = dynamic(
  () => import("@/components/dashboard/CustomizableDashboard").then((m) => m.CustomizableDashboard),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex h-64 items-center justify-center rounded-lg border border-gray-800 text-sm text-gray-400"
        data-testid="dashboard-loading"
      >
        Loading your dashboard…
      </div>
    ),
  }
);

export default function DashboardWidgetsPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8">
      <CustomizableDashboard />
    </main>
  );
}
