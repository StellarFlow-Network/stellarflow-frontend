"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, HelpCircle, X } from "lucide-react";

const TOUR_STORAGE_KEY = "stellarflow.onboarding.completed";

interface TourStep {
  target: string;
  title: string;
  description: string;
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="wallet-connect"]',
    title: "Connect your wallet",
    description: "Connect Freighter to view your account and use StellarFlow actions.",
  },
  {
    target: '[data-tour="tour-swap"]',
    title: "Swap assets",
    description: "Open the swap workspace to exchange supported assets on Stellar.",
  },
  {
    target: '[data-tour="tour-liquidity"]',
    title: "Provide liquidity",
    description: "Explore liquidity pools and track opportunities across supported pairs.",
  },
  {
    target: '[data-tour="tour-remittance"]',
    title: "Send cross-border remittances",
    description: "Use the remittance flow to follow an international payment from start to settlement.",
  },
];

function readTourCompletion(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(TOUR_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function persistTourCompletion(): void {
  try {
    window.localStorage.setItem(TOUR_STORAGE_KEY, "true");
  } catch {
    // Completion persistence is best-effort when storage is unavailable.
  }
}

function getSpotlightRect(selector: string): SpotlightRect {
  const target = document.querySelector<HTMLElement>(selector);
  if (target) {
    const rect = target.getBoundingClientRect();
    return {
      top: rect.top - 8,
      left: rect.left - 8,
      width: rect.width + 16,
      height: rect.height + 16,
    };
  }

  return {
    top: window.innerHeight / 2 - 24,
    left: window.innerWidth / 2 - 120,
    width: 240,
    height: 48,
  };
}

export function GuidedTour() {
  const [isOpen, setIsOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);

  const closeTour = useCallback((completed: boolean) => {
    if (completed) persistTourCompletion();
    setIsOpen(false);
    setSpotlight(null);
  }, []);

  const openTour = useCallback(() => {
    setStepIndex(0);
    setIsOpen(true);
  }, []);

  useEffect(() => {
    const autoStartTimer = window.setTimeout(() => {
      if (!readTourCompletion()) setIsOpen(true);
    }, 500);
    return () => window.clearTimeout(autoStartTimer);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const updateSpotlight = () => {
      setSpotlight(getSpotlightRect(TOUR_STEPS[stepIndex].target));
    };

    updateSpotlight();
    window.addEventListener("resize", updateSpotlight);
    window.addEventListener("scroll", updateSpotlight, true);
    return () => {
      window.removeEventListener("resize", updateSpotlight);
      window.removeEventListener("scroll", updateSpotlight, true);
    };
  }, [isOpen, stepIndex]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeTour(false);
      if (event.key === "ArrowRight") {
        if (stepIndex === TOUR_STEPS.length - 1) closeTour(true);
        else setStepIndex((current) => current + 1);
      }
      if (event.key === "ArrowLeft" && stepIndex > 0) {
        setStepIndex((current) => current - 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeTour, isOpen, stepIndex]);

  const step = TOUR_STEPS[stepIndex];
  const isLastStep = stepIndex === TOUR_STEPS.length - 1;

  return (
    <>
      <button
        type="button"
        onClick={openTour}
        className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground/80 transition-colors hover:bg-control-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-green"
        aria-label="Help and replay tour"
      >
        <HelpCircle size={16} aria-hidden="true" />
        <span>Help &amp; Replay Tour</span>
      </button>

      <AnimatePresence>
        {isOpen && spotlight && (
          <motion.div
            className="fixed inset-0 z-[100] pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            aria-hidden="true"
          >
            <motion.div
              className="absolute rounded-xl border-2 border-neon-green shadow-[0_0_0_9999px_rgba(2,8,23,0.72),0_0_24px_rgba(57,255,20,0.35)]"
              animate={spotlight}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="guided-tour-title"
            className="fixed inset-x-4 bottom-4 z-[101] mx-auto max-w-md rounded-2xl border border-border bg-surface p-5 text-foreground shadow-2xl sm:inset-x-auto sm:right-6 sm:bottom-6"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neon-green">
                  Step {stepIndex + 1} of {TOUR_STEPS.length}
                </p>
                <h2 id="guided-tour-title" className="mt-1 text-lg font-semibold">
                  {step.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => closeTour(false)}
                className="rounded-md p-1 text-foreground/60 transition-colors hover:bg-control-hover hover:text-foreground"
                aria-label="Close tour"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <p className="mt-2 text-sm leading-6 text-foreground/70">{step.description}</p>
            <div className="mt-5 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => closeTour(false)}
                className="text-sm font-medium text-foreground/60 hover:text-foreground"
              >
                Skip tour
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStepIndex((current) => current - 1)}
                  disabled={stepIndex === 0}
                  className="rounded-md border border-border p-2 text-foreground/70 transition-colors hover:bg-control-hover disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Previous tour step"
                >
                  <ArrowLeft size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (isLastStep) closeTour(true);
                    else setStepIndex((current) => current + 1);
                  }}
                  className="inline-flex items-center gap-2 rounded-md bg-neon-green px-3 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
                >
                  {isLastStep ? "Finish" : "Next"}
                  {isLastStep ? null : <ArrowRight size={16} aria-hidden="true" />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default GuidedTour;
