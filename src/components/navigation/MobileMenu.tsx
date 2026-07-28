"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";
import type { IconId } from "@/components/icons/iconIds";

const WalletConnectButton = dynamic(
  () => import("@/app/components/WalletConnectButton"),
  { ssr: false }
);

const navItems: { iconId: IconId; label: string; href: string }[] = [
  { iconId: ICON_IDS.layoutDashboard, label: "Dashboard",  href: "/" },
  { iconId: ICON_IDS.database,        label: "Contracts",  href: "/contracts" },
  { iconId: ICON_IDS.lineChart,       label: "Analytics",  href: "/analytics" },
  { iconId: ICON_IDS.globe,           label: "Governance", href: "/governance" },
  { iconId: ICON_IDS.settings,        label: "Settings",   href: "/settings" },
];

type PathProps = React.ComponentProps<typeof motion.path>;

const Path = (props: PathProps) => (
  <motion.path
    fill="transparent"
    strokeWidth="2.5"
    stroke="currentColor"
    strokeLinecap="round"
    {...props}
  />
);

export default function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Focus trap: keep focus within the drawer when open
  useEffect(() => {
    if (!isOpen) return;
    const menu = menuRef.current;
    if (!menu) return;

    const focusableElements = menu.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    // Focus the first element when drawer opens
    setTimeout(() => firstFocusable?.focus(), 50);

    function handleTab(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    }

    document.addEventListener("keydown", handleTab);
    return () => document.removeEventListener("keydown", handleTab);
  }, [isOpen]);

  // Return focus to toggle button when menu closes
  useEffect(() => {
    if (!isOpen) {
      toggleRef.current?.focus();
    }
  }, [isOpen]);

  // Sync route change with closing the menu drawer
  useEffect(() => {
    const closeTimer = window.setTimeout(() => setIsOpen(false), 0);
    return () => window.clearTimeout(closeTimer);
  }, [pathname]);

  const handleDragEnd = (
    _: MouseEvent | TouchEvent | PointerEvent,
    info: { offset: { x: number }; velocity: { x: number } }
  ) => {
    const swipeDistance = info.offset.x;
    const swipeVelocity = info.velocity.x;

    // Close on an intentional leftward swipe.
    if (swipeDistance < -80 || swipeVelocity < -500) {
      closeMenu();
    }
  };

  return (
    <div className="md:hidden flex items-center">
      {/* Hamburger Toggle Button */}
      <motion.button
        onClick={toggleOpen}
        whileTap={{ scale: 0.92 }}
        animate={isOpen ? { rotate: 90 } : { rotate: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 24 }}
        className="p-2 text-slate-200 hover:text-white rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#99dc1b] focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 z-50 relative"
        aria-label={isOpen ? "Close menu" : "Open menu"}
      >
        <svg width="22" height="22" viewBox="0 0 23 23">
          <Path
            animate={isOpen ? { d: "M 3 16.5 L 17 2.5" } : { d: "M 2 2.5 L 20 2.5" }}
            transition={{ duration: 0.15 }}
          />
          <Path
            d="M 2 9.4 L 20 9.4"
            animate={isOpen ? { opacity: 0 } : { opacity: 1 }}
            transition={{ duration: 0.15 }}
          />
          <Path
            animate={isOpen ? { d: "M 3 2.5 L 17 16.5" } : { d: "M 2 16.3 L 20 16.3" }}
            transition={{ duration: 0.15 }}
          />
        </svg>
      </motion.button>

      {/* Drawer Overlay + Drawer Menu */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={closeMenu}
              className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
            />

            {/* Slide-out Drawer */}
            <motion.div
              ref={menuRef}
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", ease: "easeInOut", duration: 0.25 }}
              drag="x"
              dragDirectionLock
              dragConstraints={{ left: -280, right: 0 }}
              dragElastic={0.08}
              onDragEnd={handleDragEnd}
              className="fixed top-0 left-0 bottom-0 w-[280px] bg-zinc-950 border-r border-zinc-800 z-40 flex flex-col p-6 pt-20 justify-between shadow-2xl"
            >
              {/* Top Navigation Items */}
              <div className="space-y-6">
                <nav className="flex flex-col gap-2">
                  {navItems.map(({ iconId, label, href }) => {
                    const isActive = pathname === href;
                    return (
                      <Link
                        key={label}
                        href={href}
                        onClick={closeMenu}
                        className="flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200"
                        style={{
                          color: isActive ? "#f5c842" : "rgba(255,255,255,0.65)",
                          background: isActive ? "rgba(245,200,66,0.1)" : "transparent",
                        }}
                      >
                        <Icon id={iconId} size={18} strokeWidth={isActive ? 2.2 : 1.8} />
                        <span>{label}</span>
                      </Link>
                    );
                  })}
                </nav>
              </div>

              {/* Bottom Triggers Panel */}
              <div className="border-t border-zinc-800/80 pt-6 space-y-4">
                {/* Wallet Connect Trigger */}
                <div className="w-full">
                  <WalletConnectButton />
                </div>

                {/* Anomaly Alerts, Settings and Sign Out Row */}
                <div className="flex items-center justify-between gap-2 px-1">
                  {/* Alerts Trigger */}
                  <button
                    aria-label="System anomaly alerts"
                    className="flex-1 flex items-center justify-center p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-slate-200 hover:bg-zinc-800 transition-colors"
                    onClick={() => {
                      closeMenu();
                      alert("View current system anomalies (implement dashboard logic)");
                    }}
                  >
                    <Icon id={ICON_IDS.bell} size={18} />
                  </button>

                  {/* Settings Trigger */}
                  <Link
                    href="/admin/settings"
                    onClick={closeMenu}
                    aria-label="Admin settings"
                    className="flex-1 flex items-center justify-center p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-slate-200 hover:bg-zinc-800 transition-colors"
                  >
                    <Icon id={ICON_IDS.user} size={18} />
                  </Link>

                  {/* Logout Trigger */}
                  <button
                    aria-label="Sign out"
                    className="flex-1 flex items-center justify-center p-3 rounded-xl bg-rose-950/20 border border-rose-900/30 text-rose-400 hover:bg-rose-950/40 transition-colors"
                    onClick={() => {
                      closeMenu();
                      alert("Sign out (implement)");
                    }}
                  >
                    <Icon id={ICON_IDS.logOut} size={18} />
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
