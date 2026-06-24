"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes";
import { useMounted } from "@/app/hooks/useMounted";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const mounted = useMounted();
  
  // Serve static placeholder during SSR to prevent hydration mismatch
  if (!mounted) {
    return <>{children}</>;
  }
  
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
