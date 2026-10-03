"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";
import MobileDrawerNav from "./MobileDrawerNav";

const navItems = [
  { iconId: ICON_IDS.layoutDashboard, label: "Home", href: "/" },
  { iconId: ICON_IDS.database, label: "Contracts", href: "/contracts" },
  { iconId: ICON_IDS.globe, label: "Governance", href: "/governance" },
  { iconId: ICON_IDS.signal, label: "RPC", href: "/rpc-benchmark" },
] as const;

const drawerRoutes = [
  "/dashboard/portfolio",
  "/multisig",
  "/settings",
];

function matchesRoute(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

export default function MobileBottomNav() {
  const pathname = usePathname() ?? "/";
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const isDrawerRouteActive = drawerRoutes.some((href) => matchesRoute(pathname, href));

  return (
    <>
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(0,0,0,0.18)] backdrop-blur md:hidden"
      >
        <ul className="mx-auto grid h-16 max-w-xl grid-cols-5 items-stretch px-1">
          {navItems.map(({ iconId, label, href }) => {
            const isActive = matchesRoute(pathname, href);
            return (
              <li key={href} className="min-w-0">
                <Link
                  href={href}
                  aria-label={label}
                  aria-current={isActive ? "page" : undefined}
                  className={`relative flex h-full min-h-12 flex-col items-center justify-center gap-1 rounded-md transition-colors duration-200 focus-visible:z-10 ${
                    isActive ? "text-[#b6eb3d]" : "text-foreground/60 hover:text-foreground"
                  }`}
                >
                  <motion.span
                    className="flex h-6 w-6 items-center justify-center"
                    animate={{ y: isActive ? -2 : 0, scale: isActive ? 1.08 : 1 }}
                    transition={{ type: "spring", stiffness: 360, damping: 26 }}
                  >
                    <Icon id={iconId} size={21} strokeWidth={isActive ? 2.2 : 1.8} />
                  </motion.span>
                  <span className="max-w-full truncate text-[10px] font-medium leading-3">
                    {label}
                  </span>
                  <motion.span
                    aria-hidden="true"
                    className="absolute top-0 h-0.5 w-6 rounded-full bg-[#b6eb3d]"
                    initial={false}
                    animate={{ opacity: isActive ? 1 : 0, scaleX: isActive ? 1 : 0.4 }}
                    transition={{ duration: 0.2 }}
                  />
                </Link>
              </li>
            );
          })}
          <li className="min-w-0">
            <button
              type="button"
              aria-label="More navigation options"
              aria-haspopup="dialog"
              aria-expanded={isDrawerOpen}
              onClick={() => setIsDrawerOpen(true)}
              className={`relative flex h-full min-h-12 w-full flex-col items-center justify-center gap-1 rounded-md transition-colors duration-200 focus-visible:z-10 ${
                isDrawerOpen || isDrawerRouteActive
                  ? "text-[#b6eb3d]"
                  : "text-foreground/60 hover:text-foreground"
              }`}
            >
              <motion.span
                className="flex h-6 w-6 items-center justify-center"
                animate={{ rotate: isDrawerOpen ? 90 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <Icon id={ICON_IDS.moreVertical} size={21} />
              </motion.span>
              <span className="text-[10px] font-medium leading-3">More</span>
              <motion.span
                aria-hidden="true"
                className="absolute top-0 h-0.5 w-6 rounded-full bg-[#b6eb3d]"
                initial={false}
                animate={{
                  opacity: isDrawerOpen || isDrawerRouteActive ? 1 : 0,
                  scaleX: isDrawerOpen || isDrawerRouteActive ? 1 : 0.4,
                }}
                transition={{ duration: 0.2 }}
              />
            </button>
          </li>
        </ul>
      </nav>
      <MobileDrawerNav isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
    </>
  );
}