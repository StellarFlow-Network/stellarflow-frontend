"use client";

import React, { useState } from "react";
import {
  Radio,
  FileCheck2,
  Network,
  SlidersHorizontal,
} from "lucide-react";

interface Tab {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
}

const adminTabs: Tab[] = [
  { id: "live-oracle", label: "Live Oracle", icon: Radio },
  { id: "contract-status", label: "Contract Status", icon: FileCheck2 },
  { id: "data-relayers", label: "Data Relayers", icon: Network },
  { id: "admin-settings", label: "Admin Settings", icon: SlidersHorizontal },
];

interface AdminTabBarProps {
  /** The currently active tab id. If not provided, defaults to 'live-oracle'. */
  activeTab?: string;
  /** Called when a tab is clicked, receives the tab id. */
  onTabChange?: (tabId: string) => void;
}

export default function AdminTabBar({
  activeTab: controlledActiveTab,
  onTabChange,
}: AdminTabBarProps) {
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
      <nav className="admin-tabbar" role="tablist" aria-label="Admin navigation">
        {adminTabs.map(({ id, label, icon: Icon }) => {
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
              <Icon size={16} strokeWidth={isActive ? 2.2 : 1.6} />
              <span>{label}</span>

              {/* Cyber Lime active underline */}
              <span
                className="admin-tab__indicator"
                aria-hidden="true"
              />
            </button>
          );
        })}
      </nav>
    </div>
  );
}
