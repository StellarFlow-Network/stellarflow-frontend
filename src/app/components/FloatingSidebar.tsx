"use client";

import React, { memo, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Database,
  LineChart,
  Globe,
  Settings,
} from "lucide-react";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: Database, label: "Contracts", href: "/contracts" },
  { icon: LineChart, label: "Analytics", href: "/analytics" },
  { icon: Globe, label: "Governance", href: "/governance" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

const FloatingSidebar = memo(() => {
  const pathname = usePathname();
  const router = useRouter();
  const [active, setActive] = useState(pathname ?? "Dashboard");

  const handleSetActive = useCallback((href: string) => {
    setActive(href);
  }, []);

  const handlePrefetch = useCallback(
    (href: string) => {
      if (!href) return;
      if (href === pathname) return;

      try {
        // Proactively trigger Next.js route prefetch to start asset compilation
        router.prefetch(href);
      } catch (err) {
        // Swallow — prefetch is advisory and may throw in some environments
        // eslint-disable-next-line no-console
        console.debug("Prefetch failed for", href, err);
      }
    },
    [router],
  );
  const handlePrefetch = useCallback(
    (href: string) => {
      if (href === "/contracts") {
        router.prefetch("/contracts");
      }
    },
    [router],
  );

  return (
    <nav
      className="fixed left-2 top-1/2 z-50 flex h-auto w-14 flex-col items-center justify-start gap-2 rounded-full px-2 py-4 -translate-y-1/2 md:left-4 md:top-1/2 md:w-auto md:max-w-none md:px-2 md:py-4"
      style={{
        background: "rgba(15, 23, 35, 0.8)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        willChange: "transform",
      }}
      aria-label="Primary dashboard navigation"
    >
      {navItems.map(({ icon: Icon, label, href }) => {
        const isActive = pathname === href || active === href;

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
              prefetch={href === "/contracts" ? false : undefined}
              onClick={() => handleSetActive(href)}
              onFocus={() => handlePrefetch(href)}
              onMouseOver={() => handlePrefetch(href)}
              data-tooltip={label}
              className="relative flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200 hover:scale-110 hover:bg-white/[0.08] hover:text-white"
              style={{
                color: isActive ? "#f5c842" : "rgba(255,255,255,0.45)",
                background: isActive ? "rgba(245,200,66,0.12)" : "transparent",
              }}
              aria-label={label}
            >
              <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
            </Link>

            
          </div>
        );
      })}
    </nav>
  );
});

export default memo(FloatingSidebar);
