"use client";

import React, { memo, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";
import type { IconId } from "@/components/icons/iconIds";
import { useMounted } from "@/app/hooks/useMounted";

const navItems: { iconId: IconId; label: string; href: string }[] = [
  { iconId: ICON_IDS.layoutDashboard, label: "Dashboard",  href: "/" },
  { iconId: ICON_IDS.database,        label: "Contracts",  href: "/contracts" },
  { iconId: ICON_IDS.lineChart,       label: "Analytics",  href: "/analytics" },
  { iconId: ICON_IDS.globe,           label: "Governance", href: "/governance" },
  { iconId: ICON_IDS.settings,        label: "Settings",   href: "/settings" },
];

const FloatingSidebar = memo(() => {
  const mounted = useMounted();
  const pathname = usePathname();
  const router = useRouter();
  const [active, setActive] = useState(pathname ?? "Dashboard");
  const [hovered, setHovered] = useState<string | null>(null);

  // Sync active state with pathname after mount to avoid hydration mismatch
  useEffect(() => {
    if (mounted && pathname) {
      setActive(pathname);
    }
  }, [mounted, pathname]);

  const handleSetActive = useCallback((href: string) => {
    setActive(href);
  }, []);

  const handleSetHovered = useCallback((label: string | null) => {
    setHovered(label);
  }, []);

  const handlePrefetch = useCallback((href: string) => {
    if (!href || href === pathname) return;
    try {
      router.prefetch(href);
    } catch (err) {
      console.debug('Prefetch failed for', href, err);
    }
  }, [router, pathname]);

  // Serve static placeholder during SSR to prevent hydration mismatch
  if (!mounted) {
    return (
      <nav
        className="fixed left-2 top-1/2 z-50 flex h-auto w-14 flex-col items-center justify-start gap-2 rounded-full px-2 py-4 -translate-y-1/2 md:left-4 md:top-1/2 md:w-auto md:max-w-none md:px-2 md:py-4"
        style={{
          background: "rgb(15, 23, 35)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          willChange: "transform",
        }}
        aria-label="Primary dashboard navigation"
      >
        {navItems.map(({ iconId, label, href }) => (
          <div key={label} className="relative flex items-center">
            <Link
              href={href}
              prefetch={false}
              className="relative flex h-11 w-11 items-center justify-center rounded-full transition-all duration-200"
              style={{
                color: "rgba(255,255,255,0.45)",
                background: "transparent",
              }}
              aria-label={label}
            >
              <Icon id={iconId} size={20} strokeWidth={1.8} />
            </Link>
          </div>
        ))}
      </nav>
    );
  }

  return (
    <nav
      className="fixed left-2 top-1/2 z-50 flex h-auto w-14 flex-col items-center justify-start gap-2 rounded-full px-2 py-4 -translate-y-1/2 md:left-4 md:top-1/2 md:w-auto md:max-w-none md:px-2 md:py-4"
      style={{
        background: "rgb(15, 23, 35)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        willChange: "transform",
      }}
      aria-label="Primary dashboard navigation"
    >
      {navItems.map(({ iconId, label, href }) => {
        const isActive = pathname === href || active === href;
        const isHovered = hovered === label;

        return (
          <div key={label} className="relative flex items-center">
            {/* Gold active indicator for desktop and mobile */}
            {isActive && (
              <>
                <span
                  className="hidden md:block absolute -left-2 rounded-full"
                  style={{
                    width: "3px",
                    height: "28px",
                    background: "linear-gradient(180deg, #f5c842, #e0a800)",
                    boxShadow: "0 0 8px rgba(245,200,66,0.6)",
                  }}
                />
                <span
                  className="md:hidden absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full"
                  style={{
                    width: "3px",
                    height: "3px",
                    background: "#f5c842",
                    boxShadow: "0 0 8px rgba(245,200,66,0.6)",
                  }}
                />
              </>
            )}

            <Link
              href={href}
              prefetch={false}
              onClick={() => handleSetActive(href)}
              onFocus={() => handlePrefetch(href)}
              onMouseEnter={() => {
                handleSetHovered(label);
                handlePrefetch(href);
              }}
              onPointerEnter={() => handlePrefetch(href)}
              onMouseOver={() => handlePrefetch(href)}
              onMouseLeave={() => handleSetHovered(null)}
              className="relative flex h-11 w-11 items-center justify-center rounded-full transition-all duration-200"
              style={{
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
                transform: isHovered && !isActive ? "scale(1.08)" : "scale(1)",
              }}
              aria-label={label}
            >
              <Icon id={iconId} size={20} strokeWidth={isActive ? 2.2 : 1.8} />
            </Link>

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
});

export default memo(FloatingSidebar);
