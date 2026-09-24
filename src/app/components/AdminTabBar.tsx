"use client";

import React, { memo, useState } from "react";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";
import type { IconId } from "@/components/icons/iconIds";


interface Tab {
  id: string;
  label: string;
  iconId: IconId;
}

const adminTabs: Tab[] = [
  { id: "live-oracle",      label: "Live Oracle",      iconId: ICON_IDS.radio },
  { id: "contract-status",  label: "Contract Status",  iconId: ICON_IDS.fileCheck },
  { id: "data-relayers",    label: "Data Relayers",    iconId: ICON_IDS.network },
  { id: "admin-settings",   label: "Admin Settings",   iconId: ICON_IDS.sliders },
];

interface AdminTabBarProps {
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
}

const AdminTabBar = ({ activeTab: controlledActiveTab, onTabChange }: AdminTabBarProps) => {
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
              <Icon id={iconId} size={16} strokeWidth={isActive ? 2.2 : 1.6} />
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
