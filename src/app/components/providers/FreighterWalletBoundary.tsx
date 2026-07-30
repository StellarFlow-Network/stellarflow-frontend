"use client";

/**
 * FreighterWalletBoundary.tsx
 *
 * Thin client boundary that provides `<FreighterWalletProvider>` to the
 * component tree.  Wrapping here (rather than in the Server Component layout)
 * satisfies Next.js App Router's requirement that Context providers be Client
 * Components while keeping layout.tsx a Server Component.
 */

import { FreighterWalletProvider } from "@/context/FreighterWalletContext";

export function FreighterWalletBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  return <FreighterWalletProvider>{children}</FreighterWalletProvider>;
}
