/**
 * Shared Vitest setup (issue #565).
 *
 * Provides jsdom-friendly mocks for browser/Next.js primitives that are not
 * available (or not desirable) in the test environment, so component tests can
 * focus on behaviour instead of environment shims.
 */

import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";
import React from "react";

// ── next/image ───────────────────────────────────────────────────────────────
// Render a plain <img> so tests never need the Next.js image optimizer.

vi.mock("next/image", async () => {
  const { default: React } = await import("react");

  const NextImageMock = (props: {
    src: string;
    alt?: string;
    width?: number;
    height?: number;
    className?: string;
    style?: React.CSSProperties;
  }) => {
    const { src, alt, width, height, className, style, ...rest } = props;
    const imgProps: React.ImgHTMLAttributes<HTMLImageElement> = {
      src,
      alt,
      width,
      height,
      className,
      style,
      srcSet: undefined,
      ...rest,
    };
    delete imgProps.srcSet;
    return React.createElement("img", imgProps);
  };

  NextImageMock.displayName = "NextImageMock";
  return { __esModule: true, default: NextImageMock };
});

// ── next/navigation ──────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  usePathname: () => "/test",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// ── framer-motion ────────────────────────────────────────────────────────────
// Animations are visual concerns; stub them to their children in the tests.

vi.mock("framer-motion", async () => {
  const { default: React } = await import("react");

  const Static = ({ children, ...rest }: { children?: React.ReactNode; [key: string]: unknown }) =>
    React.createElement("div", rest, children);
  const StaticButton = ({ children, ...rest }: { children?: React.ReactNode; [key: string]: unknown }) =>
    React.createElement("button", rest, children);

  return {
    __esModule: true,
    AnimatePresence: ({ children, ...rest }: { children?: React.ReactNode; [key: string]: unknown }) =>
      React.createElement("div", rest, children),
    motion: { div: Static, button: StaticButton, span: Static },
    useReducedMotion: () => false,
    useMotionValue: () => ({ get: () => 0 }),
    useSpring: () => ({ get: () => 0 }),
    useTransform: () => ({ get: () => 0 }),
  };
});

// ── Transaction audio / haptics side-effects ─────────────────────────────────

vi.mock("@/lib/haptics", () => ({
  triggerHaptic: vi.fn(),
}));

vi.mock("@/hooks/useTransactionAudio", () => ({
  useTransactionAudio: () => ({
    playSuccess: vi.fn(),
    playFailure: vi.fn(),
  }),
}));

// ── Browser API polyfills jsdom does not implement ───────────────────────────

if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

if (!window.ResizeObserver) {
  Object.defineProperty(window, "ResizeObserver", {
    writable: true,
    value: class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  });
}

if (!window.scrollTo) {
  Object.defineProperty(window, "scrollTo", {
    writable: true,
    value: vi.fn(),
  });
}