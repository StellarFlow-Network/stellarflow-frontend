"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";

const navItems = [
  { iconId: ICON_IDS.layoutDashboard, label: "Dashboard", href: "/" },
  { iconId: ICON_IDS.database, label: "Contracts", href: "/contracts" },
  { iconId: ICON_IDS.lineChart, label: "Portfolio", href: "/dashboard/portfolio" },
  { iconId: ICON_IDS.globe, label: "Governance", href: "/governance" },
  { iconId: ICON_IDS.shieldCheck, label: "Multi-signature", href: "/multisig" },
  { iconId: ICON_IDS.signal, label: "RPC Benchmark", href: "/rpc-benchmark" },
  { iconId: ICON_IDS.settings, label: "Settings", href: "/settings" },
] as const;

interface MobileDrawerNavProps {
  isOpen: boolean;
  onClose: () => void;
}

function matchesRoute(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

export default function MobileDrawerNav({ isOpen, onClose }: MobileDrawerNavProps) {
  const pathname = usePathname() ?? "/";
  const previousPathname = useRef(pathname);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (previousPathname.current !== pathname) {
      previousPathname.current = pathname;
      onClose();
    }
  }, [pathname, onClose]);

  const handleDragEnd = (
    _: MouseEvent | TouchEvent | PointerEvent,
    info: { offset: { x: number }; velocity: { x: number } },
  ) => {
    if (info.offset.x > 80 || info.velocity.x > 500) onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="md:hidden">
          <motion.button
            type="button"
            aria-label="Close navigation drawer"
            className="fixed inset-0 z-50 cursor-default bg-black/55 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Additional navigation"
            className="glass-surface glass-nav fixed inset-y-0 right-0 z-50 flex w-[min(22rem,88vw)] flex-col border-l px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] text-foreground shadow-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
            drag="x"
            dragDirectionLock
            dragConstraints={{ left: 0, right: 352 }}
            dragElastic={0.08}
            onDragEnd={handleDragEnd}
          >
            <div className="mb-5 flex min-h-12 items-center justify-between border-b border-border pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground/50">
                  Navigate
                </p>
                <h2 className="mt-1 text-lg font-semibold">StellarFlow</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close navigation drawer"
                className="flex h-12 w-12 items-center justify-center rounded-md text-foreground/70 transition-colors hover:bg-control-hover hover:text-foreground"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <nav aria-label="More pages" className="flex-1">
              <ul className="space-y-1">
                {navItems.map(({ iconId, label, href }) => {
                  const isActive = matchesRoute(pathname, href);
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        onClick={onClose}
                        aria-current={isActive ? "page" : undefined}
                        className={`flex min-h-12 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors focus-visible:z-10 ${
                          isActive
                            ? "bg-[#b6eb3d]/10 text-[#b6eb3d]"
                            : "text-foreground/75 hover:bg-control-hover hover:text-foreground"
                        }`}
                      >
                        <Icon id={iconId} size={19} strokeWidth={isActive ? 2.2 : 1.8} />
                        <span>{label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}