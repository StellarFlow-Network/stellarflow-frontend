"use client";

import React, { memo, useState } from "react";

interface Tab {
  id: string;
  label: string;
  iconId: string;
}

const adminTabs: Tab[] = [
  { id: "live-oracle", label: "Live Oracle", iconId: "admin-icon-radio" },
  {
    id: "contract-status",
    label: "Contract Status",
    iconId: "admin-icon-file-check",
  },
  { id: "data-relayers", label: "Data Relayers", iconId: "admin-icon-network" },
  {
    id: "admin-settings",
    label: "Admin Settings",
    iconId: "admin-icon-sliders",
  },
];

interface AdminTabBarProps {
  /** The currently active tab id. If not provided, defaults to 'live-oracle'. */
  activeTab?: string;
  /** Called when a tab is clicked, receives the tab id. */
  onTabChange?: (tabId: string) => void;
}

function AdminIconDefs() {
  return (
    <svg
      width="0"
      height="0"
      aria-hidden="true"
      focusable="false"
      style={{ position: "absolute" }}
    >
      <defs>
        <symbol id="admin-icon-radio" viewBox="0 0 24 24">
          <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
          <path d="M7.8 16.2a6 6 0 0 1 0-8.5" />
          <circle cx="12" cy="12" r="2" />
          <path d="M16.2 7.8a6 6 0 0 1 0 8.5" />
          <path d="M19.1 4.9c3.9 3.9 3.9 10.2 0 14.1" />
        </symbol>

        <symbol id="admin-icon-file-check" viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="m9 15 2 2 4-4" />
        </symbol>

        <symbol id="admin-icon-network" viewBox="0 0 24 24">
          <rect x="16" y="16" width="6" height="6" rx="1" />
          <rect x="2" y="16" width="6" height="6" rx="1" />
          <rect x="9" y="2" width="6" height="6" rx="1" />
          <path d="M12 8v4" />
          <path d="M5 16v-2a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2" />
        </symbol>

        <symbol id="admin-icon-sliders" viewBox="0 0 24 24">
          <path d="M21 4H14" />
          <path d="M10 4H3" />
          <path d="M21 12H12" />
          <path d="M8 12H3" />
          <path d="M21 20H16" />
          <path d="M12 20H3" />
          <circle cx="12" cy="4" r="2" />
          <circle cx="10" cy="12" r="2" />
          <circle cx="14" cy="20" r="2" />
        </symbol>
      </defs>
    </svg>
  );
}

function AdminTabIcon({
  iconId,
  isActive,
}: {
  iconId: string;
  isActive: boolean;
}) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={isActive ? 2.2 : 1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <use href={`#${iconId}`} />
    </svg>
  );
}

const AdminTabBar = ({
  activeTab: controlledActiveTab,
  onTabChange,
}: AdminTabBarProps) => {
  const [internalActiveTab, setInternalActiveTab] = useState("live-oracle");
  const activeTab = controlledActiveTab ?? internalActiveTab;

  const handleTabClick = (tabId: string) => {
    if (onTabChange) {
      onTabChange(tabId);
    } else {
      setInternalActiveTab(tabId);
    }
  };

  return (
    <div className="admin-tabbar-wrapper">
      <AdminIconDefs />

      <nav
        className="admin-tabbar"
        role="tablist"
        aria-label="Admin navigation"
      >
        {adminTabs.map(({ id, label, iconId }) => {
          const isActive = activeTab === id;

          return (
            <button
              key={id}
              id={`admin-tab-${id}`}
              role="tab"
              aria-selected={isActive}
              aria-controls={`admin-panel-${id}`}
              className={`admin-tab ${isActive ? "admin-tab--active" : ""}`}
              onClick={() => handleTabClick(id)}
              type="button"
            >
              <AdminTabIcon iconId={iconId} isActive={isActive} />
              <span>{label}</span>

              <span className="admin-tab__indicator" aria-hidden="true" />
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default memo(AdminTabBar);
