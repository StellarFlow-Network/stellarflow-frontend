/**
 * Font Configuration - Bundled at Build Time
 * 
 * All fonts are self-hosted via next/font/google:
 * - Zero runtime render-blocking font HTTP requests
 * - Automatic font subsetting for optimal bundle size
 * - font-display: swap eliminates layout shift (FOUT prevention)
 * - CSS variables injected for seamless integration with Tailwind
 * 
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/fonts
 */

import { Inter, Roboto_Mono } from "next/font/google";

/**
 * Primary Sans-Serif Font: Inter
 * 
 * Optimized with:
 * - Variable font axis for efficient weight rendering
 * - Latin subset only (reduces bundle ~70%)
 * - display: swap prevents invisible text flash (FOIT)
 * - preload: true for critical rendering path optimization
 */
export const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
  preload: true,
  fallback: [
    "-apple-system",
    "BlinkMacSystemFont",
    "Segoe UI",
    "Roboto",
    "sans-serif"
  ],
  adjustFontFallback: true, // Automatic metric override for fallback fonts
});

/**
 * Monospace Font: Roboto Mono
 * 
 * Used for:
 * - Code snippets and terminal output
 * - Wallet addresses and transaction hashes
 * - Numeric data displays requiring tabular alignment
 */
export const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "700"],
  preload: true,
  fallback: [
    "Consolas",
    "Monaco",
    "Courier New",
    "monospace"
  ],
  adjustFontFallback: true,
});

/**
 * Legacy Geist Fonts (Optional - Remove if no longer needed)
 * 
 * Keeping these exports for backward compatibility during migration.
 * Once all references are updated to Inter/Roboto Mono, these can be removed.
 */
// Uncomment if you need to maintain Geist fonts alongside Inter
// import { Geist, Geist_Mono } from "next/font/google";
// export const geistSans = Geist({
//   variable: "--font-geist-sans",
//   subsets: ["latin"],
//   display: "swap",
//   weight: ["400", "700"],
// });
// export const geistMono = Geist_Mono({
//   variable: "--font-geist-mono",
//   subsets: ["latin"],
//   display: "swap",
//   weight: ["400", "700"],
// });
