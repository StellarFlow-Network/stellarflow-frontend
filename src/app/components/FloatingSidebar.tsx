"use client";

import React, { useState } from "react";
import {
  LayoutDashboard,
  Database,
  LineChart,
  Globe,
  Settings,
} from "lucide-react";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "#" },
  { icon: Database, label: "Data", href: "#" },
  { icon: LineChart, label: "Analytics", href: "#" },
  { icon: Globe, label: "Governance", href: "#" },
  { icon: Settings, label: "Settings", href: "#" },
];

export default function FloatingSidebar() {
  const [active, setActive] = useState("Dashboard");
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <nav
      className="fixed left-4 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-2 rounded-full px-2 py-4"
      style={{
        background: "rgba(15, 23, 35, 0.75)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      }}
    >
      {navItems.map(({ icon: Icon, label, href }) => {
        const isActive = active === label;
        const isHovered = hovered === label;

        return (
          <div key={label} className="relative flex items-center">
            {/* Gold active indicator */}
            {isActive && (
              <span
                className="absolute -left-2 rounded-full"
                style={{
                  width: "3px",
                  height: "28px",
                  background: "linear-gradient(180deg, #f5c842, #e0a800)",
                  boxShadow: "0 0 8px rgba(245,200,66,0.6)",
                }}
              />
            )}

            <a
              href={href}
              onClick={(e) => {
                e.preventDefault();
                setActive(label);
              }}
              onMouseEnter={() => setHovered(label)}
              onMouseLeave={() => setHovered(null)}
              className="relative flex items-center justify-center rounded-xl transition-all duration-200"
              style={{
                width: "44px",
                height: "44px",
                color: isActive
                  ? "#f5c842"
                  : isHovered
                    ? "#ffffff"
                    : "rgba(255,255,255,0.45)",
                background: isActive
                  ? "rgba(245,200,66,0.12)"
                  : isHovered
                    ? "rgba(255,255,255,0.08)"
                    : "transparent",
                transform: isHovered && !isActive ? "scale(1.15)" : "scale(1)",
              }}
              aria-label={label}
            >
              <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
            </a>

            {/* Tooltip */}
            {isHovered && (
              <span
                className="absolute left-14 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold pointer-events-none"
                style={{
                  background: "rgba(15,23,35,0.95)",
                  border: "1px solid rgba(245,200,66,0.3)",
                  color: "#f5c842",
                  letterSpacing: "0.04em",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                }}
              >
                {label}
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
